import { accessSync, constants, existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { CONFIG_PATH } from '../paths.js';
import { readTemplates, planChanges } from '../claude-home.js';

// `kb doctor` — relatório ✓/✗ do conjunto do harness.
//
// Cada check nasceu de uma dor real; não remova nenhum sem registrar o porquê:
//   - kb config ausente deixa todo o resto sem chão;
//   - plugin instalado mas DESABILITADO em enabledPlugins passou semanas despercebido;
//   - hook do guard ausente deixa freeze/wtree sem guardrail;
//   - graphify com skill desatualizada gera grafo silenciosamente velho;
//   - credencial n8n dev apontando pro auth de PROD já queimou dados reais;
//   - estação nova (6–12): ferramenta que o CLAUDE.md global manda usar faltando no
//     PATH, gregioos/dotfiles não aplicados e blocos do CLAUDE.md em versão velha — o
//     agente obedece a uma regra que a máquina não sustenta e trava sem dizer por quê.
//
// Exit 1 se houver qualquer ✗ — automação depende do exit code, não do texto. Check
// pulado (docker/graphify ausente) imprime `-` e não conta como falha.
//
// Read-only ABSOLUTO: o doctor só lê e sugere o comando de correção; quem conserta é o
// humano rodando `kb scaffold` / `fr` / `./install.sh`. Duas execuções seguidas têm de
// imprimir exatamente a mesma coisa e não tocar em nada.

const home = homedir();
const settingsPath = join(home, '.claude', 'settings.json');
const installedPluginsPath = join(home, '.claude', 'plugins', 'installed_plugins.json');

// Host de PROD do n8n — credencial dev apontando pra cá já queimou dados reais.
const N8N_PROD_HOST = 'auth.nxttrainingapp.com';

// Plataforma. NixOS é `/run/current-system`: `/etc/NIXOS` sumiu no 26.05 e quem checava
// por ele passou a tratar a estação como Linux genérico, dando a dica de correção errada.
const IS_NIXOS = existsSync('/run/current-system');
const IS_DARWIN = process.platform === 'darwin';

// Ferramentas que o CLAUDE.md global assume existir (o `claude` sai à parte: a correção
// dele não é a mesma). `node` também é à parte — lá a versão importa, não só a presença.
const REQUIRED_TOOLS = ['rg', 'fd', 'jq', 'yq', 'http', 'gh', 'herdr', 'wtree', 'stow', 'pnpm'];
const MIN_NODE_MAJOR = 20;

// Sugestão de instalação depende de onde a máquina é gerenciada.
const installHint = IS_NIXOS
  ? 'adicione o pacote ao gregioos e rode `fr`'
  : IS_DARWIN
    ? 'adicione ao gregioos (nix-darwin) e rode `fu`'
    : 'instale pelo gerenciador de pacotes da distro';

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
  try {
    const installed = readJson(installedPluginsPath).plugins ?? {};
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

  // 3. hook do guard (guardrail de freeze/wtree) em hooks.PreToolUse.
  //    Transição: o guard virou subcomando (`kb guard`), mas quem ainda aponta para o
  //    guard.mjs antigo continua protegido — passa com nota de migração.
  if (settings) {
    const commands = preToolUseCommands(settings);
    const viaKb = commands.some(c => c.includes('kb guard'));
    const viaLegacy = commands.some(c => c.includes('guard.mjs'));
    if (viaKb) {
      check(true, 'hook guard em PreToolUse', 'kb guard');
    } else if (viaLegacy) {
      check(true, 'hook guard em PreToolUse', 'guard.mjs (legado) — migre o command para "kb guard"');
    } else {
      check(false, 'hook guard em PreToolUse', `guardrail de freeze/wtree ausente — adicione em ${settingsPath}: hooks.PreToolUse[{matcher:"Edit|Write|NotebookEdit", hooks:[{type:"command", command:"kb guard"}]}]`);
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

  // 5. n8n dev: workflow importado apontando pro auth de PROD (credencial dev → prod)
  const ps = sh('docker', ['ps', '--format', '{{.Names}}']);
  if (ps.error || !ps.ok) {
    skip('n8n dev → prod', 'docker indisponível');
  } else if (!ps.out.split('\n').includes('n8n-dev')) {
    skip('n8n dev → prod', 'container n8n-dev não está rodando');
  } else {
    // $POSTGRES_USER é expandido pelo `sh -c` DE DENTRO do container — não trocar por
    // expansão local.
    const query = `psql -U $POSTGRES_USER -d n8n_dev -t -A -c "select count(*) from workflow_entity where nodes::text like '%${N8N_PROD_HOST}%'"`;
    const q = sh('docker', ['exec', 'postgres-dev', 'sh', '-c', query]);
    if (!q.ok) {
      check(false, 'n8n dev → prod', `query falhou: ${q.out || q.error?.message}`);
    } else {
      const count = Number(q.out);
      check(count === 0, 'n8n dev → prod', count === 0
        ? `nenhum workflow aponta para ${N8N_PROD_HOST}`
        : `${count} workflow(s) apontam para ${N8N_PROD_HOST} — credencial dev usando prod!`);
    }
  }

  // 6. `claude` no PATH — o fluxo diário inteiro (consolidate do arquivador, devflow,
  //    os panes de agente do herdr) chama o CLI pelo nome; sem ele a estação parece
  //    montada e falha só na hora do uso. Correção é própria: npm global ou o módulo do
  //    gregioos, dependendo de como a máquina é gerenciada.
  const hasClaude = onPath('claude');
  check(hasClaude, 'claude no PATH', hasClaude
    ? 'ok'
    : `ausente — \`npm install -g @anthropic-ai/claude-code\`${IS_NIXOS || IS_DARWIN ? ' ou habilite o módulo claude-code no gregioos' : ''}`);

  // 7. ferramentas do CLAUDE.md global. Dor real: a regra proíbe find/grep/curl, então
  //    numa estação sem rg/fd/jq/yq/http o agente fica sem substituto e trava sem
  //    entender o motivo; herdr/wtree são o fluxo devflow inteiro (worktree + panes) e
  //    stow é o `install.sh` do dotfiles. Um ✗ por ferramenta ausente (a correção é por
  //    pacote), um ✓ agregado quando todas estão presentes.
  const missingTools = REQUIRED_TOOLS.filter(t => !onPath(t));
  if (missingTools.length === 0) {
    check(true, 'ferramentas no PATH', REQUIRED_TOOLS.join(' '));
  } else {
    for (const tool of missingTools) {
      check(false, `ferramenta ${tool}`, `ausente do PATH — ${installHint}`);
    }
  }

  // 8. node ≥ 20: o engine kb e os scripts do harness são ESM sem dependências e assumem
  //    20+ (o arquivador precisa de --env-file, que só existe do 20.6 em diante).
  const nodeVersion = sh('node', ['--version']);
  if (!nodeVersion.ok) {
    check(false, 'node ≥ 20', `node não encontrado no PATH — ${installHint}`);
  } else {
    const major = Number(nodeVersion.out.replace(/^v/, '').split('.')[0]);
    check(major >= MIN_NODE_MAJOR, 'node ≥ 20', major >= MIN_NODE_MAJOR
      ? nodeVersion.out
      : `${nodeVersion.out} — ${installHint}`);
  }

  // 9. gregioos: a config declarativa da máquina. Sem ela nenhuma correção sugerida pelos
  //    checks acima é aplicável (é lá que pacote entra). Só se aplica onde há Nix
  //    gerenciando o sistema — em Linux genérico o check é pulado, não falha.
  const gregioosDir = join(home, 'gregioos');
  if (!IS_NIXOS && !IS_DARWIN) {
    skip('gregioos', 'estação não é NixOS nem macOS/nix-darwin — config do sistema não se aplica');
  } else if (!existsSync(join(gregioosDir, '.git'))) {
    check(false, 'gregioos', `${gregioosDir} não é um repo git — clone o gregioos aí e aplique com \`${IS_NIXOS ? 'fr' : 'fu'}\``);
  } else {
    check(true, 'gregioos', gregioosDir);
  }

  // 10. dotfiles + stow aplicado. Dor real: máquina que ficou na branch errada tinha o
  //     repo clonado mas o stow nunca rodou — tudo "existia" e nenhuma config estava no
  //     lugar, e ninguém percebeu. A sentinela é o symlink do starship apontando para
  //     dentro do dotfiles: repo presente não prova stow aplicado.
  const dotfilesDir = join(home, 'code', 'dotfiles');
  const dotfilesReal = realPathOrNull(dotfilesDir);
  const starshipPath = join(home, '.config', 'starship.toml');
  const starshipTarget = realPathOrNull(starshipPath);
  if (!dotfilesReal) {
    check(false, 'dotfiles', `${dotfilesDir} não existe — clone o dotfiles aí e rode ./install.sh (ordem: \`${IS_NIXOS ? 'fr' : 'fu'}\` antes do stow)`);
  } else if (!starshipTarget || !isInside(starshipTarget, dotfilesReal)) {
    check(false, 'dotfiles (stow aplicado)', `${starshipPath} não aponta para dentro de ${dotfilesDir} — rode ./install.sh (ordem: \`${IS_NIXOS ? 'fr' : 'fu'}\` antes do stow)`);
  } else {
    check(true, 'dotfiles (stow aplicado)', `${starshipPath} → ${starshipTarget}`);
  }

  // 11. workspace. `~/code/worktrees` é onde o wtree cria os worktrees e
  //     `~/code/.scratchpad` é o /tmp dos agentes — faltando, o agente escreve arquivo
  //     temporário onde não devia (ou o wtree falha na hora errada).
  const workspaceDirs = [join(home, 'code'), join(home, 'code', 'worktrees'), join(home, 'code', '.scratchpad')];
  const missingDirs = workspaceDirs.filter(d => !existsSync(d));
  check(missingDirs.length === 0, 'workspace ~/code', missingDirs.length === 0
    ? workspaceDirs.join(', ')
    : `faltam ${missingDirs.join(', ')} — rode \`kb scaffold\``);

  // 12. blocos gerenciados do ~/.claude/CLAUDE.md. Dor real: bloco em versão velha é
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

  const failures = results.filter(ok => !ok).length;
  console.log(failures ? `\n✗ ${failures} problema(s) encontrado(s)` : '\n✓ tudo certo');
  if (failures) process.exitCode = 1;
}
