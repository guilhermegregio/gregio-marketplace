import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { asList } from '../args.js';
import { loadConfig, saveConfig } from '../config.js';
import { CONFIG_PATH } from '../paths.js';
import {
  CLAUDE_HOME_TEMPLATES,
  listProfiles,
  parseBlocks,
  planChanges,
  readTemplates,
  renderTemplates,
  selectTemplates,
} from '../claude-home.js';

// `kb scaffold [--profiles a,b] [--dry-run] [--list]`
//
// Bootstrap da estação: os diretórios do workspace (`~/code`, `~/code/worktrees`,
// `~/code/.scratchpad`) e os blocos gerenciados do `~/.claude/CLAUDE.md`.
//
// A decisão sobre o CLAUDE.md não mora aqui: é `claude-home.js/planChanges` (pura),
// compartilhada com o `kb doctor` — doctor que discorda do scaffold mandaria o humano
// rodar um comando que não muda nada. Este arquivo é só I/O + relatório.
//
// Idempotência é requisito de contrato, não gentileza: a segunda execução não pode
// tocar em mtime nenhum. Por isso todo write é precedido de comparação de conteúdo, e
// o retrato do `fastfetch` só é capturado quando há de fato algo a escrever (o miolo
// de um bloco na mesma versão nunca é reescrito — se fosse, o uptime da máquina
// sozinho já quebraria a idempotência).
//
// Contrato congelado: `cli/kb/behaviors.feature`.

/**
 * README do scratchpad, gerenciado com a mesma mecânica de marcador dos blocos do
 * CLAUDE.md — assim ele ganha versão, atualiza in-place e nunca engole um README
 * artesanal que alguém tenha escrito por cima.
 */
const SCRATCHPAD_README = {
  block: 'scratchpad',
  profiles: ['all'],
  order: 1,
  version: 1,
  file: 'README.md',
  body: `# .scratchpad — área de trabalho efêmera

Tudo aqui é **efêmero e pode ser apagado a qualquer momento**. Nada neste diretório é
backup, nada vai para o git, nada é fonte da verdade de coisa alguma.

**Este diretório substitui o \`/tmp\` para os agentes**: scripts descartáveis, saídas
intermediárias, rascunhos e arquivos de trabalho de uma sessão vivem aqui, e não em
\`/tmp\` (que some no boot e some do meu campo de visão) nem dentro de um repo.

Se algo daqui merece sobreviver, promova para o repo certo ou para o vault.
`,
};

function homePaths() {
  const home = homedir();
  const code = join(home, 'code');
  return {
    home,
    code,
    dirs: [code, join(code, 'worktrees'), join(code, '.scratchpad')],
    readme: join(code, '.scratchpad', 'README.md'),
    claudeMd: join(home, '.claude', 'CLAUDE.md'),
  };
}

/** Encurta o home no relatório — caminho curto é mais fácil de conferir de olho. */
function tilde(p, home) {
  return p === home ? '~' : p.startsWith(`${home}/`) ? `~/${p.slice(home.length + 1)}` : p;
}

/**
 * Retrato da máquina para o token `{{FASTFETCH}}`. Sem fastfetch no PATH o bloco entra
 * com a instrução em vez do retrato — estação sem fastfetch continua ganhando o resto
 * do CLAUDE.md, que é o que importa.
 */
function captureFastfetch() {
  // O módulo de paleta do fastfetch imprime duas linhas feitas só de escape ANSI —
  // saem mesmo redirecionado, e dentro do bloco de código o agente lê aquilo como lixo.
  // Por isso limpamos o escape e descartamos a linha que sobrou vazia. (`--pipe` não
  // ajuda: testado, não muda uma vírgula da saída.)
  const r = spawnSync('fastfetch', ['-l', 'none'], { encoding: 'utf8' });
  if (r.error || r.status !== 0 || !r.stdout?.trim()) {
    return '> `fastfetch` não estava disponível quando este bloco foi escrito.\n' +
      '> Rode `fastfetch -l none` para ver a máquina agora.';
  }
  const clean = r.stdout
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split('\n')
    .filter(line => line.trim() !== '')
    .join('\n');
  return `\`\`\`\n${clean}\n\`\`\``;
}

const SIGN = { create: '+', update: '~', remove: '-' };
const VERB_APPLY = { create: 'criado', update: 'atualizado', remove: 'removido' };
const VERB_DRY = { create: 'criar', update: 'atualizar', remove: 'remover' };

function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

/** `--list`: o seletor — perfis do manifest × ativos, e versão instalada × disponível. */
function printList(templates, active, paths) {
  const available = listProfiles(templates);
  const installed = new Map(parseBlocks(readIfExists(paths.claudeMd)).map(b => [b.block, b.version]));
  const activeSet = new Set(active);
  const selected = new Set(selectTemplates(templates, active).map(t => t.block));

  console.log(`templates: ${CLAUDE_HOME_TEMPLATES}`);
  console.log(`config:    ${CONFIG_PATH}`);
  console.log(`CLAUDE.md: ${tilde(paths.claudeMd, paths.home)}`);

  console.log('\nperfis disponíveis (do manifest):');
  if (!available.length) console.log('  (nenhum — todos os blocos são "all")');
  for (const p of available) {
    console.log(`  ${activeSet.has(p) ? '*' : ' '} ${p.padEnd(12)} ${activeSet.has(p) ? 'ativo' : ''}`.trimEnd());
  }
  // Perfil salvo que sumiu do manifest continua aparecendo: some da lista sem aviso é
  // como bloco "desaparecido" vira mistério na próxima estação.
  for (const p of active.filter(p => !available.includes(p))) {
    console.log(`  * ${p.padEnd(12)} ativo (não existe mais no manifest)`);
  }

  console.log('\nblocos:');
  console.log(`  ${'bloco'.padEnd(16)}${'perfis'.padEnd(14)}${'instalado'.padEnd(11)}disponível`);
  for (const t of templates) {
    const inst = installed.has(t.block) ? `v${installed.get(t.block)}` : '-';
    const note = selected.has(t.block) ? '' : '  (perfil inativo)';
    console.log(
      `  ${t.block.padEnd(16)}${t.profiles.join(',').padEnd(14)}${inst.padEnd(11)}v${t.version}${note}`,
    );
  }
  for (const orphan of installed.keys()) {
    if (!templates.some(t => t.block === orphan)) {
      console.log(`  ${orphan.padEnd(16)}${'?'.padEnd(14)}v${installed.get(orphan)}${''.padEnd(9)}(sem template — não é tocado)`);
    }
  }
}

export async function run({ opts }) {
  const templates = readTemplates();
  const available = listProfiles(templates);
  const paths = homePaths();

  const config = await loadConfig({ required: false });
  const saved = Array.isArray(config.scaffold?.profiles) ? config.scaffold.profiles : null;
  // Flag presente = escolha explícita (inclusive `--profiles` vazio, que zera). Sem
  // flag, valem os perfis salvos; sem salvos, só os blocos "all".
  const explicit = 'profiles' in opts ? asList(opts.profiles) : null;
  const active = explicit ?? saved ?? [];

  if (opts.list) {
    printList(templates, active, paths);
    return;
  }

  const dryRun = Boolean(opts['dry-run']);
  const unknown = active.filter(p => !available.includes(p));
  if (unknown.length) {
    console.log(
      `aviso: perfil sem bloco no manifest: ${unknown.join(', ')} ` +
        `(disponíveis: ${available.join(', ') || 'nenhum'})`,
    );
  }

  const changes = [];
  const add = (kind, what) => changes.push({ kind, what });

  // 1. Workspace.
  const missingDirs = paths.dirs.filter(d => !existsSync(d));
  for (const d of missingDirs) add('create', tilde(d, paths.home));

  const readmeBefore = readIfExists(paths.readme);
  const readmePlan = planChanges(readmeBefore, [SCRATCHPAD_README], []);
  for (const w of readmePlan.writes) add('create', `${tilde(paths.readme, paths.home)} (bloco ${w.block} v${w.version})`);
  for (const u of readmePlan.updates) add('update', `${tilde(paths.readme, paths.home)} (bloco ${u.block} v${u.from} → v${u.to})`);

  // 2. Blocos do CLAUDE.md. A decisão não depende do miolo dos templates, então o
  //    plano é calculado antes de capturar o `{{FASTFETCH}}`.
  const claudeBefore = readIfExists(paths.claudeMd);
  const plan = planChanges(claudeBefore, templates, active);
  const md = tilde(paths.claudeMd, paths.home);
  for (const w of plan.writes) add('create', `${md}: bloco ${w.block} v${w.version}`);
  for (const u of plan.updates) add('update', `${md}: bloco ${u.block} v${u.from} → v${u.to}`);
  for (const r of plan.removes) add('remove', `${md}: bloco ${r.block} v${r.version} (perfil desativado)`);

  // 3. Perfis na config.
  const profilesChanged = explicit !== null && JSON.stringify(saved ?? []) !== JSON.stringify(explicit);
  if (profilesChanged) {
    add(saved === null ? 'create' : 'update', `${tilde(CONFIG_PATH, paths.home)}: scaffold.profiles = [${explicit.join(', ')}]`);
  }

  console.log(`perfis:  ${active.join(', ') || '(nenhum — só os blocos "all")'}`);
  console.log(`blocos:  ${selectTemplates(templates, active).map(t => t.block).join(', ') || '(nenhum)'}`);
  if (plan.unchanged.length) {
    console.log(`em dia:  ${plan.unchanged.map(b => `${b.block} v${b.version}`).join(', ')}`);
  }
  if (plan.orphans.length) {
    console.log(
      `nota:    bloco(s) sem template no manifest ficam como estão: ` +
        `${plan.orphans.map(o => `${o.block} v${o.version}`).join(', ')}`,
    );
  }

  const verbs = dryRun ? VERB_DRY : VERB_APPLY;
  if (changes.length) {
    console.log('');
    for (const c of changes) console.log(`  ${SIGN[c.kind]} ${verbs[c.kind].padEnd(11)}${c.what}`);
  }

  if (!changes.length) {
    console.log('\n✓ tudo em dia — nada a fazer.');
    return;
  }

  if (dryRun) {
    console.log(`\n(dry-run) ${changes.length} mudança(s) pendente(s) — nada foi escrito.`);
    return;
  }

  // --- Aplicação ---
  for (const d of missingDirs) mkdirSync(d, { recursive: true });

  if (readmePlan.changed && readmePlan.resultText !== readmeBefore) {
    writeFileSync(paths.readme, readmePlan.resultText);
  }

  if (plan.changed) {
    // Só agora o retrato da máquina é capturado: o plano acima já disse que há bloco a
    // escrever. `planChanges` é pura e decide por nome/versão, então o replano com os
    // templates renderizados toma exatamente a mesma decisão.
    const rendered = renderTemplates(templates, { FASTFETCH: captureFastfetch() });
    const final = planChanges(claudeBefore, rendered, active);
    if (final.resultText !== claudeBefore) {
      mkdirSync(dirname(paths.claudeMd), { recursive: true });
      writeFileSync(paths.claudeMd, final.resultText);
    }
  }

  if (profilesChanged) {
    // saveConfig só garante o CONFIG_DIR padrão; com KB_CONFIG apontando para outro
    // lugar, o diretório de destino é por nossa conta.
    mkdirSync(dirname(CONFIG_PATH), { recursive: true });
    await saveConfig({ ...config, scaffold: { ...config.scaffold, profiles: explicit } });
  }

  console.log(`\n✓ ${changes.length} mudança(s) aplicada(s).`);
}
