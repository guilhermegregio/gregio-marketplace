import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '../../frontmatter.js';

// Núcleo compartilhado do `kb dev` — parsing de plano, DAG e ready-set. SEM side-effects.

// Resolve o diretório do plano (ativo ou arquivado).
export function planDir(vaultRoot, slug) {
  const active = join(vaultRoot, '30-plans', slug);
  if (existsSync(active)) return active;
  const archived = join(vaultRoot, '30-plans', '_archive', slug);
  if (existsSync(archived)) return archived;
  throw new Error(`plano "${slug}" não encontrado em 30-plans/ nem _archive/`);
}

// Lê _plan.md + tasks/*.md. Devolve { dir, plan:{fm,body}, tasks:[{id,fm,body,path}] }.
export async function loadPlan(vaultRoot, slug) {
  const dir = planDir(vaultRoot, slug);
  const planPath = join(dir, '_plan.md');
  if (!existsSync(planPath)) throw new Error(`_plan.md ausente em ${dir}`);
  const plan = parse(await readFile(planPath, 'utf8'));

  const tasksDir = join(dir, 'tasks');
  const tasks = [];
  if (existsSync(tasksDir)) {
    // `_task.md` é o MODELO (vem com id T01 preenchido pelo skeleton) — arquivo
    // começando com `_` nunca é task, senão o template entra no DAG.
    const files = (await readdir(tasksDir))
      .filter(f => f.endsWith('.md') && !f.startsWith('_'))
      .sort();
    for (const f of files) {
      const p = join(tasksDir, f);
      const { frontmatter, body } = parse(await readFile(p, 'utf8'));
      if (!frontmatter?.id) continue; // ignora _task.md template / arquivos sem id
      tasks.push({ id: frontmatter.id, fm: frontmatter, body, path: p });
    }
  }
  return { dir, plan, tasks };
}

// Valida o DAG: deps existentes (sem órfã) e sem ciclo (Kahn). Lança erro descritivo.
export function buildDag(tasks) {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const deps = new Map();
  for (const t of tasks) {
    const d = t.fm.depends_on ?? [];
    for (const dep of d) {
      if (!byId.has(dep)) throw new Error(`task ${t.id}: dep órfã "${dep}" (não existe no plano)`);
    }
    deps.set(t.id, [...d]);
  }
  // Kahn: detecta ciclo.
  const indeg = new Map(tasks.map(t => [t.id, (deps.get(t.id) ?? []).length]));
  const queue = [...indeg].filter(([, n]) => n === 0).map(([id]) => id);
  let seen = 0;
  const dependents = new Map(tasks.map(t => [t.id, []]));
  for (const t of tasks) for (const dep of deps.get(t.id) ?? []) dependents.get(dep).push(t.id);
  while (queue.length) {
    const id = queue.shift();
    seen++;
    for (const child of dependents.get(id) ?? []) {
      indeg.set(child, indeg.get(child) - 1);
      if (indeg.get(child) === 0) queue.push(child);
    }
  }
  if (seen !== tasks.length) throw new Error('DAG inválido: há ciclo de dependências entre tasks');
  return { byId, deps, dependents };
}

// Dois escopos colidem se algum par de paths é igual ou um prefixa o outro (glob simples).
function norm(p) {
  return String(p).replace(/\/?\*+$/, '').replace(/\/+$/, '');
}
export function scopeOverlaps(a = [], b = []) {
  // Scope malformado (null, string solta, item vazio no YAML) não pode derrubar o
  // planejamento: normaliza para lista de strings úteis.
  const list = v => (Array.isArray(v) ? v : v == null ? [] : [v]).filter(Boolean).map(String);
  for (const x of list(a).map(norm)) {
    for (const y of list(b).map(norm)) {
      if (x === y || x.startsWith(y + '/') || y.startsWith(x + '/')) return true;
    }
  }
  return false;
}

// Tasks despacháveis: status todo + todas as deps done + escopo disjunto dos `runningScopes`.
export function readySet(tasks, { runningScopes = [] } = {}) {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const done = id => byId.get(id)?.fm.status === 'done';
  return tasks.filter(t => {
    if (t.fm.status !== 'todo') return false;
    if (!(t.fm.depends_on ?? []).every(done)) return false;
    if (runningScopes.some(s => scopeOverlaps(t.fm.scope ?? [], s))) return false;
    return true;
  });
}
