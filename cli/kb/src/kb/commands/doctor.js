import { accessSync, constants, existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { CONFIG_PATH, expandPath } from '../paths.js';
import { readTemplates, planChanges } from '../claude-home.js';
import { findRulesDir } from './rules.js';

// `kb doctor` — relatório ✓/✗ do conjunto do harness.
//
// Escopo: o doctor valida o que O HARNESS precisa para rodar (config do kb, plugins,
// hook do guard, graphify, rules, ferramentas do contrato, workspace e blocos do
// CLAUDE.md). Topologia de repos, config declarativa da máquina e serviços de quem usa
// NÃO entram aqui — este código é público e roda na estação de outras pessoas. Essas
// cicatrizes viram `doctor.checks` na config do usuário (ver o bloco 9).
//
// Cada check nasceu de uma dor real; não remova nenhum sem registrar o porquê (o
// registro das remoções fica em packages/gregio-cc-harness/CLAUDE.md):
//   - kb config ausente deixa todo o resto sem chão;
//   - plugin instalado mas DESABILITADO em enabledPlugins passou semanas despercebido;
//   - hook do guard ausente deixa freeze/wtree sem guardrail;
//   - graphify com skill desatualizada gera grafo silenciosamente velho;
//   - rules que não resolvem só falham na hora do `kb rules`, já dentro do repo alvo —
//     tarde demais, e com o repo pela metade;
//   - estação nova (6–11): ferramenta que o CLAUDE.md global manda usar faltando no
//     PATH, workspace incompleto e blocos do CLAUDE.md em versão velha — o agente
//     obedece a uma regra que a máquina não sustenta e trava sem dizer por quê.
//
// Exit 1 se houver qualquer ✗ — automação depende do exit code, não do texto. Check
// pulado (graphify ausente, plataforma que não se aplica) imprime `-` e não conta como
// falha.
//
// Read-only ABSOLUTO: o doctor só lê e sugere o comando de correção; quem conserta é o
// humano. Duas execuções seguidas têm de imprimir exatamente a mesma coisa e não tocar
// em nada. Isso vale para os checks daqui; um check `command` declarado pelo usuário é
// responsabilidade dele — a doc pede comandos somente-leitura.

const home = homedir();
const settingsPath = join(home, '.claude', 'settings.json');
const installedPluginsPath = join(home, '.claude', 'plugins', 'installed_plugins.json');

// Plataforma. NixOS é `/run/current-system`: `/etc/NIXOS` sumiu no 26.05 e quem checava
// por ele passou a tratar a estação como Linux genérico, dando a dica de correção errada.
const IS_NIXOS = existsSync('/run/current-system');
const IS_DARWIN = process.platform === 'darwin';

// Tokens aceitos em `platforms` dos checks da config. NixOS é `linux` E `nixos`.
const PLATFORM_TAGS = [process.platform, ...(IS_NIXOS ? ['nixos'] : [])];

// Ferramentas que o CLAUDE.md global assume existir (o `claude` sai à parte: a correção
// dele não é a mesma). `node` também é à parte — lá a versão importa, não só a presença.
const REQUIRED_TOOLS = ['rg', 'fd', 'jq', 'yq', 'http', 'gh', 'herdr', 'wtree', 'pnpm'];
const MIN_NODE_MAJOR = 20;

// Sugestão de instalação depende de onde a máquina é gerenciada. Texto neutro de
// propósito: o doctor não sabe (nem deve adivinhar) qual é o seu gerenciador.
const installHint = IS_NIXOS
  ? 'instale pelo Nix (nixpkgs) e reaplique a configuração do sistema'
  : IS_DARWIN
    ? 'instale pelo gerenciador de pacotes do macOS (Homebrew ou nix-darwin)'
    : 'instale com o gerenciador de pacotes da sua máquina';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Presença de um executável no PATH, sem executá-lo. `wtree`, `herdr` e `claude` não têm
 * flag de versão estável: rodar `--version` para decidir presença transformava um exit
 * code != 0 em ✗ falso — e cada processo disparado é ruído num comando read-only.
 */
function onPath(cmd) {
  for (const dir of (process.env.PATH || '').split(delimiter)) {
    if (!dir) continue;
    try {
      accessSync(join(dir, cmd), constants.X_OK);
      return true;
    } catch {
      /* segue procurando */
    }
  }
  return false;
}

/** Symlink (mesmo relativo) resolvido, ou null se ausente/quebrado. */
function realPathOrNull(path) {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

/** `a` é o próprio `b` ou está dentro dele — comparação de path, não de prefixo de string. */
function isInside(child, parent) {
  return child === parent || child.startsWith(parent + sep);
}

function sh(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return { ok: r.status === 0 && !r.error, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim(), error: r.error };
}

/**
 * Comandos de hook PreToolUse. O guard é identificado pelo COMANDO, não pelo matcher
 * (que pode evoluir): hoje `kb guard`, historicamente `node .../guard.mjs`.
 */
function preToolUseCommands(settings) {
  return (settings?.hooks?.PreToolUse ?? []).flatMap(g => (g.hooks ?? []).map(h => h.command ?? ''));
}

/**
 * Comandos PreToolUse vindos de plugins HABILITADOS (`<installPath>/hooks/hooks.json`).
 * Desde o harness 0.5.0 o guard pode chegar pelo plugin `gregio-cc-harness` — sem isso o
 * doctor dava ✗ falso a quem migrou do settings.json. Plugin desabilitado não conta: o
 * Claude Code não roda os hooks dele. Arquivo ilegível é ignorado (o check de plugins já
 * cobra o que falta).
 */
function pluginPreToolUseCommands(installed, enabled) {
  return Object.entries(installed)
    .filter(([key]) => enabled[key] === true)
    .flatMap(([, entries]) => entries.map(e => e.installPath).filter(Boolean))
    .flatMap(dir => {
      try {
        return preToolUseCommands(readJson(join(dir, 'hooks', 'hooks.json')));
      } catch {
        return [];
      }
    });
}

/** `platforms` ausente/vazio = vale em toda plataforma. */
function platformApplies(platforms) {
  if (platforms === undefined) return true;
  if (!Array.isArray(platforms) || platforms.length === 0) return true;
  return platforms.some(p => PLATFORM_TAGS.includes(String(p)));
}

/** `"/re/flags"` é regex; qualquer outra string é substring. */
function matchesExpected(out, expected) {
  const asRegex = /^\/(.*)\/([a-z]*)$/s.exec(expected);
  if (asRegex) {
    try {
      return new RegExp(asRegex[1], asRegex[2]).test(out);
    } catch {
      /* regex inválida: cai no substring, e o ✗ mostra a saída */
    }
  }
  return out.includes(expected);
}

/**
 * Um check declarado em `doctor.checks` da config. Retorna estado, nunca imprime — quem
 * decide o símbolo é o chamador. Config do usuário é entrada não confiável: tudo o que
 * está malformado vira ✗ com a explicação, nunca exceção que derruba o relatório.
 */
function runUserCheck(c) {
  if (!platformApplies(c.platforms)) {
    return { state: 'skip', detail: `não se aplica a ${PLATFORM_TAGS.join('/')} (platforms: ${c.platforms.join(', ')})` };
  }

  if (c.type === 'path') {
    if (typeof c.path !== 'string') return { state: 'fail', detail: 'check inválido: "path" precisa ser string' };
    const p = expandPath(c.path);
    if (!existsSync(p)) return { state: 'fail', detail: `${p} não existe` };
    if (c.git && !existsSync(join(p, '.git'))) return { state: 'fail', detail: `${p} não é um repo git` };
    return { state: 'ok', detail: p };
  }

  // Symlink farm (stow & cia.): repo clonado não prova config aplicada — a prova é o
  // arquivo instalado resolvendo para dentro do repo de origem.
  if (c.type === 'symlink-inside') {
    if (typeof c.path !== 'string' || typeof c.target !== 'string') {
      return { state: 'fail', detail: 'check inválido: "path" e "target" precisam ser strings' };
    }
    const p = expandPath(c.path);
    const targetReal = realPathOrNull(expandPath(c.target));
    if (!targetReal) return { state: 'fail', detail: `${expandPath(c.target)} não existe` };
    const real = realPathOrNull(p);
    if (!real) return { state: 'fail', detail: `${p} não existe (ou é symlink quebrado)` };
    if (!isInside(real, targetReal)) return { state: 'fail', detail: `${p} → ${real}, fora de ${targetReal}` };
    return { state: 'ok', detail: `${p} → ${real}` };
  }

  if (c.type === 'command') {
    const argvOk = a => Array.isArray(a) && a.length > 0 && a.every(x => typeof x === 'string');
    if (!argvOk(c.argv)) return { state: 'fail', detail: 'check inválido: "argv" precisa ser um array de strings não vazio' };
    if (c.skip_if !== undefined) {
      if (!argvOk(c.skip_if)) return { state: 'fail', detail: 'check inválido: "skip_if" precisa ser um array de strings não vazio' };
      const pre = sh(c.skip_if[0], c.skip_if.slice(1));
      if (!pre.ok) return { state: 'skip', detail: `skip_if não passou: ${c.skip_if.join(' ')}` };
    }
    const r = sh(c.argv[0], c.argv.slice(1));
    const cmdLabel = c.argv.join(' ');
    // Com `expect_stdout` quem decide é o casamento (comando que sempre sai 0 não
    // provaria nada); sem ele, o exit code.
    if (c.expect_stdout !== undefined) {
      if (typeof c.expect_stdout !== 'string') return { state: 'fail', detail: 'check inválido: "expect_stdout" precisa ser string' };
      const hit = matchesExpected(r.out, c.expect_stdout);
      return hit
        ? { state: 'ok', detail: `${cmdLabel} casou com ${c.expect_stdout}` }
        : { state: 'fail', detail: `${cmdLabel} não casou com ${c.expect_stdout}${r.out ? `: ${r.out.split('\n')[0]}` : ''}` };
    }
    return r.ok
      ? { state: 'ok', detail: cmdLabel }
      : { state: 'fail', detail: `${cmdLabel} falhou${r.out ? `: ${r.out.split('\n')[0]}` : r.error ? `: ${r.error.message}` : ''}` };
  }

  return { state: 'fail', detail: `check inválido: tipo desconhecido ${JSON.stringify(c.type ?? null)} (use path, symlink-inside ou command)` };
}

export async function run() {
  const results = [];
  const check = (ok, label, detail) => {
    results.push(ok);
    console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  };
  const skip = (label, detail) => console.log(`- ${label} — ${detail}`);

  // 1. kb config (respeita KB_CONFIG / XDG_CONFIG_HOME via paths.js)
  let kbConfig = null;
  try {
    kbConfig = readJson(CONFIG_PATH);
    check(true, 'kb config', CONFIG_PATH);
  } catch (e) {
    check(false, 'kb config', `${CONFIG_PATH}: ${e.code === 'ENOENT' ? 'não existe' : e.message}`);
  }

  // 2. plugins instalados (scope user) precisam estar em enabledPlugins e habilitados.
  //    Plugin instalado mas desabilitado passa despercebido por semanas — dor real.
  let settings = null;
  try {
    settings = readJson(settingsPath);
  } catch (e) {
    check(false, 'settings.json', `${settingsPath}: ${e.message}`);
  }
  let installed = {};
  try {
    installed = readJson(installedPluginsPath).plugins ?? {};
    const enabled = settings?.enabledPlugins ?? {};
    const userScoped = Object.entries(installed).filter(([, entries]) =>
      entries.some(e => e.scope === 'user'),
    );
    for (const [key] of userScoped) {
      if (enabled[key] === true) {
        check(true, `plugin ${key}`, 'habilitado');
      } else {
        check(false, `plugin ${key}`, enabled[key] === false
          ? 'instalado mas DESABILITADO em enabledPlugins'
          : 'instalado mas ausente de enabledPlugins');
      }
    }
    if (userScoped.length === 0) skip('plugins', 'nenhum plugin com scope user instalado');
  } catch (e) {
    check(false, 'plugins instalados', `${installedPluginsPath}: ${e.message}`);
  }

  // 3. hook do guard (guardrail de freeze/wtree) em hooks.PreToolUse — no settings.json
  //    ou num plugin habilitado (o gregio-cc-harness traz o hook desde a 0.5.0).
  //    Transição: o guard virou subcomando (`kb guard`), mas quem ainda aponta para o
  //    guard.mjs antigo continua protegido — passa com nota de migração.
  if (settings) {
    const fromPlugins = pluginPreToolUseCommands(installed, settings.enabledPlugins ?? {});
    const commands = [...preToolUseCommands(settings), ...fromPlugins];
    const viaKb = commands.some(c => c.includes('kb guard'));
    const viaLegacy = commands.some(c => c.includes('guard.mjs'));
    if (viaKb) {
      check(true, 'hook guard em PreToolUse', fromPlugins.some(c => c.includes('kb guard')) ? 'kb guard (plugin)' : 'kb guard');
    } else if (viaLegacy) {
      check(true, 'hook guard em PreToolUse', 'guard.mjs (legado) — migre o command para "kb guard"');
    } else {
      check(false, 'hook guard em PreToolUse', `guardrail de freeze/wtree ausente — habilite o plugin gregio-cc-harness (traz o hook) ou adicione em ${settingsPath}: hooks.PreToolUse[{matcher:"Edit|Write|NotebookEdit", hooks:[{type:"command", command:"kb guard"}]}]`);
    }
  }

  // 4. graphify: presente e sem warning de skill desatualizada
  const g = sh('graphify', ['--version']);
  if (g.error || !g.ok) {
    check(false, 'graphify', g.error ? 'não encontrado no PATH' : g.out);
  } else {
    const warning = g.out.split('\n').find(l => /desatualizad|outdated/i.test(l));
    check(!warning, 'graphify', warning ? `warning: ${warning.trim()}` : g.out);
  }

  // 5. rules disponíveis. O `kb rules` resolve o diretório por uma cadeia de candidatos
  //    (KB_RULES_DIR → package irmão → <engine>/rules → plugin cache) e só descobre que
  //    nenhum existe na hora do uso, já dentro do repo alvo. A resolução é a MESMA do
  //    comando (importada de rules.js): duas listas divergentes dariam ✓ aqui num
  //    caminho que o `kb rules` não acharia.
  const rules = findRulesDir();
  if (!rules.dir) {
    check(false, 'rules disponíveis', `nenhum diretório resolveu — tentei: ${rules.candidates.join(', ')} — aponte KB_RULES_DIR para o diretório rules/ do gregio-cc-rules`);
  } else {
    try {
      const count = readdirSync(rules.dir).filter(f => f.endsWith('.md')).length;
      check(count > 0, 'rules disponíveis', count > 0
        ? `${count} rule(s) em ${rules.dir}`
        : `${rules.dir} existe mas não tem nenhuma rule .md — aponte KB_RULES_DIR para o diretório rules/ do gregio-cc-rules`);
    } catch (e) {
      check(false, 'rules disponíveis', `${rules.dir}: ${e.message}`);
    }
  }

  // 6. `claude` no PATH — o fluxo diário inteiro (devflow, os panes de agente, qualquer
  //    automação que chame `claude --print`) usa o CLI pelo nome; sem ele a estação
  //    parece montada e falha só na hora do uso. Correção é própria: npm global ou o
  //    pacote do gerenciador declarativo da máquina.
  const hasClaude = onPath('claude');
  check(hasClaude, 'claude no PATH', hasClaude
    ? 'ok'
    : `ausente — \`npm install -g @anthropic-ai/claude-code\`${IS_NIXOS || IS_DARWIN ? ' ou o pacote claude-code do seu gerenciador declarativo' : ''}`);

  // 7. ferramentas do CLAUDE.md global. Dor real: a regra proíbe find/grep/curl, então
  //    numa estação sem rg/fd/jq/yq/http o agente fica sem substituto e trava sem
  //    entender o motivo; herdr/wtree são o fluxo devflow inteiro (worktree + panes).
  //    Um ✗ por ferramenta ausente (a correção é por pacote), um ✓ agregado quando
  //    todas estão presentes.
  const missingTools = REQUIRED_TOOLS.filter(t => !onPath(t));
  if (missingTools.length === 0) {
    check(true, 'ferramentas no PATH', REQUIRED_TOOLS.join(' '));
  } else {
    for (const tool of missingTools) {
      check(false, `ferramenta ${tool}`, `ausente do PATH — ${installHint}`);
    }
  }

  // 8. node ≥ 20: o engine kb e os scripts do harness são ESM sem dependências e assumem
  //    20+ (`--env-file` só existe do 20.6 em diante).
  const nodeVersion = sh('node', ['--version']);
  if (!nodeVersion.ok) {
    check(false, 'node ≥ 20', `node não encontrado no PATH — ${installHint}`);
  } else {
    const major = Number(nodeVersion.out.replace(/^v/, '').split('.')[0]);
    check(major >= MIN_NODE_MAJOR, 'node ≥ 20', major >= MIN_NODE_MAJOR
      ? nodeVersion.out
      : `${nodeVersion.out} — ${installHint}`);
  }

  // 9. workspace. `~/code/worktrees` é onde o wtree cria os worktrees e
  //    `~/code/.scratchpad` é o /tmp dos agentes — faltando, o agente escreve arquivo
  //    temporário onde não devia (ou o wtree falha na hora errada).
  const workspaceDirs = [join(home, 'code'), join(home, 'code', 'worktrees'), join(home, 'code', '.scratchpad')];
  const missingDirs = workspaceDirs.filter(d => !existsSync(d));
  check(missingDirs.length === 0, 'workspace ~/code', missingDirs.length === 0
    ? workspaceDirs.join(', ')
    : `faltam ${missingDirs.join(', ')} — rode \`kb scaffold\``);

  // 10. blocos gerenciados do ~/.claude/CLAUDE.md. Dor real: bloco em versão velha é
  //     regra desatualizada obedecida ao pé da letra pelo agente — silencioso e pior que
  //     regra ausente. A decisão de drift é a MESMA do scaffold (`planChanges`, pura):
  //     doctor que discordasse do scaffold mandaria rodar um comando que não muda nada.
  //     Perfis vêm de scaffold.profiles da config; sem perfis salvos, só os blocos `all`.
  const claudeMdPath = join(home, '.claude', 'CLAUDE.md');
  const profiles = Array.isArray(kbConfig?.scaffold?.profiles) ? kbConfig.scaffold.profiles : [];
  const profilesLabel = profiles.length ? `perfis: ${profiles.join(', ')}` : 'sem perfis salvos — só blocos "all"';
  if (!existsSync(claudeMdPath)) {
    check(false, 'blocos do ~/.claude/CLAUDE.md', `${claudeMdPath} não existe — rode \`kb scaffold\``);
  } else {
    try {
      const plan = planChanges(readFileSync(claudeMdPath, 'utf8'), readTemplates(), profiles);
      const drift = [];
      if (plan.writes.length) drift.push(`faltando: ${plan.writes.map(w => `${w.block} v${w.version}`).join(', ')}`);
      if (plan.updates.length) drift.push(`desatualizados: ${plan.updates.map(u => `${u.block} v${u.from}→v${u.to}`).join(', ')}`);
      if (plan.removes.length) drift.push(`de perfil inativo: ${plan.removes.map(r => r.block).join(', ')}`);
      check(!plan.changed, 'blocos do ~/.claude/CLAUDE.md', plan.changed
        ? `${drift.join('; ')} (${profilesLabel}) — rode \`kb scaffold\``
        : `${plan.unchanged.length} bloco(s) em dia (${profilesLabel})`);
      // Bloco sem template é de um engine mais novo: o scaffold não o apaga e o doctor
      // não o cobra — só avisa, para o humano decidir.
      if (plan.orphans.length) {
        skip('blocos sem template', `${plan.orphans.map(o => o.block).join(', ')} — não são gerenciados por este engine`);
      }
    } catch (e) {
      check(false, 'blocos do ~/.claude/CLAUDE.md', `não foi possível verificar: ${e.message}`);
    }
  }

  // 11. checks extras do usuário (`doctor.checks` na config). É aqui que entra a
  //     cicatriz que é DA ESTAÇÃO de quem usa, não do harness: o repo de config do
  //     sistema, a symlink farm aplicada, o serviço que não pode estar apontando pro
  //     ambiente errado. Ordem do array = ordem da saída (o relatório é determinístico).
  //     Config malformada vira ✗ do próprio bloco e o doctor segue — diagnóstico que se
  //     recusa a rodar por causa de uma vírgula é pior do que diagnóstico incompleto.
  const extras = kbConfig?.doctor?.checks;
  if (extras !== undefined) {
    if (!Array.isArray(extras)) {
      check(false, 'doctor.checks', `${CONFIG_PATH}: doctor.checks precisa ser um array — checks extras ignorados`);
    } else {
      for (const [i, c] of extras.entries()) {
        const named = c && typeof c.label === 'string' && c.label.trim();
        const label = named || `doctor.checks[${i}]`;
        if (!c || typeof c !== 'object' || !named || typeof c.fix !== 'string') {
          check(false, label, 'check inválido: todo check precisa de "label" e "fix" (strings)');
          continue;
        }
        let r;
        try {
          r = runUserCheck(c);
        } catch (e) {
          r = { state: 'fail', detail: `erro ao avaliar o check: ${e.message}` };
        }
        if (r.state === 'skip') skip(label, r.detail);
        else if (r.state === 'ok') check(true, label, r.detail);
        else check(false, label, `${r.detail} — ${c.fix}`);
      }
    }
  }

  const failures = results.filter(ok => !ok).length;
  console.log(failures ? `\n✗ ${failures} problema(s) encontrado(s)` : '\n✓ tudo certo');
  if (failures) process.exitCode = 1;
}
