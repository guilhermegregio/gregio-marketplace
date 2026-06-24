import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { loadConfig, getVault, defaultVault, getProject } from '../../config.js';
import { expandPath } from '../../paths.js';
import { merge } from '../../frontmatter.js';
import { loadPlan, buildDag, readySet } from './plan.js';

// kb dev check <slug> [--task Txx] [--vault n]
// Sem --task: valida DAG e imprime status/ready-set (dry-run, zero side-effects).
// Com --task: roda os gates (one-shot) da task e, se verdes, marca status: review.
export async function run({ positionals, opts }) {
  const slug = positionals[0];
  if (!slug) throw new Error('uso: kb dev check <slug> [--task Txx] [--vault n]');

  const config = await loadConfig();
  const vault = opts.vault ? getVault(config, opts.vault) : defaultVault(config);
  const root = expandPath(vault.path);
  const { tasks } = await loadPlan(root, slug);
  buildDag(tasks); // lança em ciclo/órfã

  if (!opts.task) {
    console.log(`Plano ${slug} — ${tasks.length} task(s):`);
    for (const t of tasks) {
      const deps = (t.fm.depends_on ?? []).join(',') || '—';
      console.log(`  ${t.id} [${t.fm.status}] deps:${deps}  ${t.fm.title ?? ''}`);
    }
    const ready = readySet(tasks).map(t => t.id);
    console.log(`\nready agora: ${ready.join(', ') || '(nenhuma)'}`);
    return;
  }

  const task = tasks.find(t => t.id === opts.task);
  if (!task) throw new Error(`task "${opts.task}" não existe no plano ${slug}`);
  const repoPath = resolveRepo(config, task.fm.repo) || process.cwd();
  const gates = task.fm.gates ?? [];
  if (!gates.length) {
    console.log(`${task.id}: sem gates declarados — nada a rodar.`);
    return;
  }

  let allOk = true;
  for (const g of gates) {
    process.stdout.write(`  gate "${g}" ... `);
    const res = spawnSync('sh', ['-c', g], { cwd: repoPath, stdio: ['ignore', 'inherit', 'inherit'] });
    const ok = res.status === 0;
    console.log(ok ? 'ok' : `FALHOU (exit ${res.status})`);
    if (!ok) allOk = false;
  }
  if (allOk) {
    await writeFile(task.path, merge(await readFile(task.path, 'utf8'), { status: 'review', updated: today() }));
    console.log(`${task.id}: todos os gates verdes → status: review`);
  } else {
    console.log(`${task.id}: gates vermelhos — corrija e rode novamente (status inalterado).`);
    process.exitCode = 1;
  }
}

function resolveRepo(config, repo) {
  if (!repo) return null;
  const p = getProject(config, repo);
  if (p) return expandPath(p.path);
  const v = (config.vaults ?? []).find(x => x.name === repo);
  if (v) return expandPath(v.path);
  return null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
