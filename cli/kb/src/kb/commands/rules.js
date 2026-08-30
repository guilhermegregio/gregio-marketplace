import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { asList } from '../args.js';
import { ENGINE_ROOT, expandPath } from '../paths.js';

// `kb rules <repo> [--stack a,b] [--dry-run] [--prune] [--list]`
//
// Materializa as rules do package `gregio-cc-rules` em `<repo>/.claude/rules/`.
//
// O conteúdo das rules NÃO vive aqui: o engine é o instalador, o package é o dono das
// regras (cada uma nasce de uma cicatriz e é versionada lá). Cópia idempotente, sem
// estado externo — cada arquivo leva um cabeçalho com origem+versão, então re-rodar
// atualiza e o `git diff` do repo mostra o que mudou. Nada é removido sem `--prune`,
// e o `--prune` só toca no que este comando escreveu (marcador no cabeçalho).
//
// A auto-detecção de stack é por evidência no repo (package.json, diretórios), não por
// configuração — repo que passa a usar n8n ganha a rule na próxima execução.

const MARKER = 'gregio-cc-rules';

/**
 * Onde estão as rules. Ordem pensada para os quatro jeitos de rodar o kb:
 *   1. KB_RULES_DIR — escape hatch (teste, fork, rules próprias);
 *   2. checkout/worktree do gregio-marketplace — o engine mora em `cli/kb`, os
 *      packages são irmãos dois níveis acima. Vem antes do `<engine>/rules` para que,
 *      no repo, a fonte da verdade seja sempre o package (nunca uma cópia stale);
 *   3. `<engine>/rules` — caso do tarball npm (`npx @gregio/kb`, `npm i -g`) e do Nix:
 *      ali o package irmão não existe, então o `prepack` (scripts/sync-rules.mjs)
 *      copia as rules para dentro do pacote e elas viajam com ele;
 *   4. marketplace instalado via /plugin (repo clonado em ~/.claude/plugins/repos).
 */
function rulesDirCandidates() {
  return [
    process.env.KB_RULES_DIR && expandPath(process.env.KB_RULES_DIR),
    resolve(ENGINE_ROOT, '..', '..', 'packages', 'gregio-cc-rules', 'rules'),
    join(ENGINE_ROOT, 'rules'),
    join(homedir(), '.claude', 'plugins', 'repos', 'gregio-marketplace', 'packages', 'gregio-cc-rules', 'rules'),
  ].filter(Boolean);
}

/**
 * Resolução sem exceção, para quem só quer diagnosticar: `{ dir, candidates }` com
 * `dir: null` quando nada existe. O `kb doctor` usa esta função em vez de repetir a
 * cadeia — duas listas divergentes dariam ✓ no doctor num caminho que o `kb rules` não
 * acharia.
 */
export function findRulesDir() {
  const candidates = rulesDirCandidates();
  return { dir: candidates.find(existsSync) ?? null, candidates };
}

function resolveRulesDir() {
  const { dir, candidates } = findRulesDir();
  if (!dir) {
    throw new Error(
      `rules não encontradas. Procurei em:\n${candidates.map(c => `  ${c}`).join('\n')}\n` +
      'Aponte KB_RULES_DIR para o diretório rules/ do gregio-cc-rules.',
    );
  }
  return dir;
}

/** Frontmatter mínimo: `rule`, `stacks`, `version`. Sem dependência de parser YAML. */
function readRuleMeta(rulesDir, file) {
  const raw = readFileSync(join(rulesDir, file), 'utf8');
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  const meta = { rule: file.replace(/\.md$/, ''), stacks: ['all'], version: 1 };
  if (fm) {
    const stacks = fm[1].match(/^stacks:\s*\[(.*)\]/m);
    const version = fm[1].match(/^version:\s*(\d+)/m);
    if (stacks) meta.stacks = stacks[1].split(',').map(s => s.trim()).filter(Boolean);
    if (version) meta.version = Number(version[1]);
  }
  return { ...meta, file, raw };
}

/** Monorepo: as deps que importam costumam estar nos apps, não na raiz. */
function readTopLevelPackageJsons(root) {
  let out = '';
  for (const dir of ['apps', 'packages']) {
    const base = join(root, dir);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const p = join(base, entry.name, 'package.json');
      if (existsSync(p)) out += readFileSync(p, 'utf8');
    }
  }
  return out;
}

/** Evidências no repo → stacks. Barato e sem falso positivo relevante. */
function detectStacks(root) {
  const found = new Set();
  const pkgPath = join(root, 'package.json');
  const pkg = existsSync(pkgPath) ? readFileSync(pkgPath, 'utf8') : '';
  const deps = pkg + readTopLevelPackageJsons(root);
  if (/"next"\s*:/.test(deps)) found.add('next');
  if (/"astro"\s*:/.test(deps)) found.add('astro');
  if (existsSync(join(root, 'supabase', 'migrations'))) found.add('sql');
  if (existsSync(join(root, 'apps', 'n8n-workflows')) || existsSync(join(root, 'workflows'))) {
    found.add('n8n');
  }
  return [...found];
}

export async function run({ positionals, opts }) {
  const rulesDir = resolveRulesDir();
  const rules = readdirSync(rulesDir).filter(f => f.endsWith('.md')).map(f => readRuleMeta(rulesDir, f));

  if (opts.list) {
    console.log(`rules em ${rulesDir}\n`);
    for (const r of rules) console.log(`${r.rule.padEnd(18)} stacks: ${r.stacks.join(', ')}  v${r.version}`);
    return;
  }

  if (!positionals[0]) throw new Error('uso: kb rules <repo> [--stack a,b] [--dry-run] [--prune] [--list]');
  const repo = expandPath(positionals[0]);
  if (!existsSync(repo)) throw new Error(`repo não encontrado: ${repo}`);

  const explicitStacks = opts.stack ? asList(opts.stack) : null;
  const stacks = explicitStacks ?? detectStacks(repo);
  const selected = rules.filter(r => r.stacks.includes('all') || r.stacks.some(s => stacks.includes(s)));

  const target = join(repo, '.claude', 'rules');
  console.log(`repo:   ${repo}`);
  console.log(`stacks: ${stacks.length ? stacks.join(', ') : '(nenhum detectado)'}`);
  console.log(`rules:  ${selected.map(r => r.rule).join(', ') || '(nenhuma)'}`);

  if (opts['dry-run']) {
    console.log('\n(dry-run — nada escrito)');
    return;
  }

  mkdirSync(target, { recursive: true });

  let written = 0;
  for (const rule of selected) {
    const header =
      `<!-- ${MARKER}: ${rule.rule} v${rule.version} — NÃO editar aqui.\n` +
      `     Fonte: gregio-marketplace/packages/gregio-cc-rules/rules/${rule.file}\n` +
      '     Atualize rodando "kb rules <repo>" de novo. -->\n\n';
    const out = header + rule.raw;
    const dest = join(target, rule.file);
    if (existsSync(dest) && readFileSync(dest, 'utf8') === out) continue;
    writeFileSync(dest, out);
    written += 1;
  }

  if (opts.prune) {
    const keep = new Set(selected.map(r => r.file));
    for (const file of readdirSync(target)) {
      if (keep.has(file)) continue;
      // Só remove o que este comando escreveu — rule própria do repo fica.
      if (readFileSync(join(target, file), 'utf8').includes(MARKER)) rmSync(join(target, file));
    }
  }

  console.log(`\n✓ ${written} arquivo(s) atualizado(s) em ${target}`);
  console.log('  Referencie no CLAUDE.md do repo para o agente carregar sob demanda.');
}
