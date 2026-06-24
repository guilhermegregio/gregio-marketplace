import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig, getVault, defaultVault } from '../../config.js';
import { expandPath, ENGINE_ROOT } from '../../paths.js';
import { merge } from '../../frontmatter.js';
import { asList } from '../../args.js';
import { loadPlan, planDir } from './plan.js';

// kb dev done <slug> [--vault n] [--promote learning,adr,c4] [--force] [--no-graph]
// Exige tasks done → promove (kb new) → arquiva (move p/ _archive) → re-merge central.
export async function run({ positionals, opts }) {
  const slug = positionals[0];
  if (!slug) throw new Error('uso: kb dev done <slug> [--vault n] [--promote ...] [--force]');

  const config = await loadConfig();
  const vault = opts.vault ? getVault(config, opts.vault) : defaultVault(config);
  const root = expandPath(vault.path);
  const { dir, plan, tasks } = await loadPlan(root, slug);

  // 1. Gate: todas as tasks done.
  const pending = tasks.filter(t => t.fm.status !== 'done');
  if (pending.length && opts.force !== true) {
    throw new Error(`tasks pendentes: ${pending.map(t => `${t.id}(${t.fm.status})`).join(', ')} — use --force para forçar`);
  }

  // 2. Promover durável (esqueletos via `kb new`; o agente preenche).
  const promoted = [];
  for (const type of asList(opts.promote)) {
    const title = `${plan.frontmatter?.title ?? slug} — ${type}`;
    const r = spawnSync('node', [join(ENGINE_ROOT, 'bin', 'kb.js'), 'new', '--vault', vault.name, '--type', type, '--title', title], { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
    if (r.status === 0) {
      const out = (r.stdout || '').trim();
      promoted.push(`${type}: ${out.split('\n').find(l => l.includes('Nota criada')) ?? out}`);
    } else {
      console.error(`falha ao promover ${type}`);
    }
  }

  // 3. Marca o plano done + arquiva (move).
  await writeFile(join(dir, '_plan.md'), merge(await readFile(join(dir, '_plan.md'), 'utf8'), { status: 'done', done_at: today() }));
  const archiveDir = join(root, '30-plans', '_archive', slug);
  await mkdir(dirname(archiveDir), { recursive: true });
  if (existsSync(archiveDir)) throw new Error(`já arquivado: ${archiveDir}`);
  await rename(dir, archiveDir);
  await updateMoc(root, slug, plan.frontmatter?.title ?? slug);

  // 4. Re-merge do grafo central (best-effort).
  if (opts['no-graph'] !== true) {
    const g = spawnSync('node', [join(ENGINE_ROOT, 'bin', 'kb.js'), 'graph', 'merge'], { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
    console.log(g.status === 0 ? 'grafo central re-mergeado.' : 'aviso: re-merge do central falhou (rode "kb graph build" depois).');
  }

  console.log(`\nPlano ${slug} concluído e arquivado em ${archiveDir}.`);
  if (promoted.length) console.log('Promovido:\n  ' + promoted.join('\n  '));
}

// Best-effort: tira o link do slug de "Ativos" e adiciona em "Arquivados".
async function updateMoc(root, slug, title) {
  const mocPath = join(root, '30-plans', '_index.md');
  if (!existsSync(mocPath)) return;
  let text = await readFile(mocPath, 'utf8');
  text = text
    .split('\n')
    .filter(l => !(l.includes(`[[${slug}/_plan`) ))
    .join('\n');
  const line = `- [[_archive/${slug}/_plan|${title}]] — done (${today()}).`;
  if (text.includes('## Arquivados')) {
    text = text.replace(/## Arquivados\n(_\(nenhum\)_\n)?/, `## Arquivados\n${line}\n`);
  } else {
    text += `\n## Arquivados\n${line}\n`;
  }
  await writeFile(mocPath, text);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
