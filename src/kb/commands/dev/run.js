import { loadConfig, getVault, defaultVault } from '../../config.js';
import { expandPath } from '../../paths.js';
import { loadPlan, buildDag, scopeOverlaps } from './plan.js';

// kb dev run <slug> [--vault n] [--max N] [--dry-run]
// v1: computa as ONDAS de execução (deps + escopo disjunto, até N em paralelo).
// --dry-run imprime as ondas. Sem --dry-run e com herdr (HERDR_ENV), emite os
// comandos de despacho da 1ª onda (orquestrador guiado); auto-dispatch+merge é v2.
export async function run({ positionals, opts }) {
  const slug = positionals[0];
  if (!slug) throw new Error('uso: kb dev run <slug> [--vault n] [--max N] [--dry-run]');
  const max = Math.max(1, parseInt(opts.max ?? '3', 10));

  const config = await loadConfig();
  const vault = opts.vault ? getVault(config, opts.vault) : defaultVault(config);
  const root = expandPath(vault.path);
  const { plan, tasks } = await loadPlan(root, slug);
  buildDag(tasks); // ciclo/órfã

  // Gate de handoff.
  const st = plan.frontmatter?.status;
  if (st !== 'approved' && st !== 'in-progress') {
    throw new Error(`plano "${slug}" está "${st}" — aprove (status: approved) antes de "kb dev run".`);
  }

  const waves = computeWaves(tasks, max);
  if (!waves.length) {
    console.log(`Nada a executar — todas as tasks de ${slug} estão done (ou bloqueadas).`);
    return;
  }

  console.log(`Plano ${slug}: ${waves.length} onda(s) (máx ${max} paralelas):`);
  waves.forEach((w, i) => {
    console.log(`  Onda ${i + 1}: ${w.map(t => `${t.id}[${t.fm.repo ?? '?'}]`).join(' ‖ ')}`);
  });

  if (opts['dry-run'] === true) return;

  if (process.env.HERDR_ENV !== '1') {
    console.log('\n(herdr ausente — sem auto-despacho). Use --dry-run, ou execute manualmente,');
    console.log('ou rode dentro do herdr para o orquestrador guiado.');
    return;
  }

  // Orquestrador guiado (v1): emite os comandos de despacho da 1ª onda.
  // Auto-spawn do agente + sentinela + merge serial = v2 (ver plan-structure).
  console.log('\n# Onda 1 — despache cada task no seu worktree+workspace (herdr):');
  for (const t of waves[0]) {
    const branch = t.fm.branch ?? `${t.id}-${slug}`;
    console.log(`  wtree ${branch} --herdr   # depois: injete tasks/${t.id}*.md no pane AI`);
  }
  console.log('\nAo cada task reportar done: verifique `git diff --name-only ⊆ scope`,');
  console.log('faça o merge LOCAL na branch de integração, e re-rode `kb dev run` para a próxima onda.');
}

// Simula as ondas: readiness por deps + seleção gulosa de escopos disjuntos até `max`.
function computeWaves(tasks, max) {
  const status = new Map(tasks.map(t => [t.id, t.fm.status]));
  const byId = new Map(tasks.map(t => [t.id, t]));
  const waves = [];
  let guard = 0;
  while (guard++ < 1000) {
    const ready = tasks.filter(t => {
      if (status.get(t.id) !== 'todo') return false;
      return (t.fm.depends_on ?? []).every(d => status.get(d) === 'done');
    });
    if (!ready.length) break;
    // Seleção gulosa: escopos par-a-par disjuntos, até `max`.
    const wave = [];
    for (const t of ready) {
      if (wave.length >= max) break;
      if (wave.every(w => !scopeOverlaps(w.fm.scope ?? [], t.fm.scope ?? []))) wave.push(t);
    }
    if (!wave.length) break;
    for (const t of wave) status.set(t.id, 'done'); // simula conclusão
    waves.push(wave);
  }
  // tasks todo que sobraram (bloqueadas por dep não-done) ficam fora — sinaliza.
  const left = tasks.filter(t => status.get(t.id) === 'todo');
  if (left.length) console.error(`aviso: ${left.length} task(s) não alcançável(is) nesta simulação: ${left.map(t => t.id).join(', ')}`);
  void byId;
  return waves;
}
