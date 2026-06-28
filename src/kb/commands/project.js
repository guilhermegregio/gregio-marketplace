import { existsSync } from 'node:fs';
import { loadConfig, saveConfig, getProject } from '../config.js';
import { upsertProject, removeProject, upsertGroup, detectSubprojects } from '../registry.js';
import { expandPath } from '../paths.js';
import { asList } from '../args.js';
import { applyHygiene, installHook } from '../repo-hygiene.js';
import { basename, join } from 'node:path';

export async function run({ positionals, opts }) {
  const sub = positionals[0];
  switch (sub) {
    case 'add':
      return add(positionals[1], opts);
    case 'list':
      return list();
    case 'remove':
      return remove(positionals[1]);
    case 'scan':
      return scan(positionals[1]);
    case 'init-hygiene':
      return initHygiene(positionals[1]);
    default:
      console.error('uso: kb project <add|list|remove|scan|init-hygiene>');
      process.exit(1);
  }
}

// Aplica hygiene (T02) + instala hook do graphify no repo e, se monorepo, em cada
// subprojeto (cada subpath é seu próprio scan-root → precisa do .graphifyignore).
async function applyToProject(project) {
  const root = expandPath(project.path);
  const targets = [root];
  if (project.monorepo) {
    for (const sp of project.subprojects ?? []) targets.push(join(root, sp.subpath));
  }
  for (const t of targets) {
    if (!existsSync(t)) {
      console.warn(`  ! ${t}: ausente — pulando hygiene`);
      continue;
    }
    const { stack } = await applyHygiene(t);
    const hook = await installHook(t);
    const rel = t === root ? '(raiz)' : t.slice(root.length + 1);
    console.log(`  hygiene ${rel}: .graphifyignore[${stack ?? 'genérico'}] + allowlist + gitattributes` +
      (hook.ok ? ' + hook' : ' (hook: graphify indisponível, pulado)'));
  }
}

async function add(pathArg, opts) {
  if (!pathArg) throw new Error('uso: kb project add <path> [--name n] [--group g] [--no-scan] [--subproject sub]');
  const path = expandPath(pathArg);
  if (!existsSync(path)) throw new Error(`path não existe: ${path}`);

  const config = await loadConfig({ required: false });
  const name = opts.name || basename(path);

  const project = { name, path, graphOut: 'graphify-out/graph.json', includeInCentral: true };

  if (opts['no-scan'] !== true) {
    const explicit = asList(opts.subproject);
    const { isMono, candidates } = detectSubprojects(path, name);
    let subs = [];
    if (explicit.length) {
      subs = explicit.map(sp => ({ name: `${name}-${basename(sp)}`, subpath: sp }));
    } else if (isMono && candidates.length) {
      subs = candidates;
    }
    if (subs.length) {
      project.monorepo = true;
      project.subprojects = subs;
      console.log(`Monorepo detectado: ${subs.length} subprojeto(s):`);
      for (const s of subs) console.log(`  └ ${s.name}  (${s.subpath})`);
    }
  }

  upsertProject(config, project);

  if (opts.group) {
    const g = (config.groups ?? []).find(x => x.name === opts.group) || { name: opts.group, members: [] };
    if (!g.members.includes(name)) g.members.push(name);
    upsertGroup(config, g);
    console.log(`Filiado ao grupo "${opts.group}".`);
  }

  await saveConfig(config);
  console.log(`Projeto "${name}" registrado.`);

  if (opts['no-hygiene'] !== true) {
    console.log('Aplicando hygiene + hook do graphify:');
    await applyToProject(project);
  }
  console.log('Rode "kb graph build" para incluir no grafo central.');
}

async function initHygiene(name) {
  if (!name) throw new Error('uso: kb project init-hygiene <nome>');
  const config = await loadConfig();
  const p = getProject(config, name);
  if (!p) throw new Error(`projeto "${name}" não registrado (veja "kb project list")`);
  console.log(`Hygiene para "${name}":`);
  await applyToProject(p);
}

async function list() {
  const config = await loadConfig({ required: false });
  for (const p of config.projects ?? []) {
    console.log(`${p.name}  ${p.path}${p.monorepo ? '  [monorepo]' : ''}`);
    for (const sp of p.subprojects ?? []) console.log(`  └ ${sp.name}  (${sp.subpath})`);
  }
  if (!(config.projects ?? []).length) console.log('(nenhum projeto registrado)');
}

async function remove(name) {
  if (!name) throw new Error('uso: kb project remove <nome>');
  const config = await loadConfig();
  removeProject(config, name);
  await saveConfig(config);
  console.log(`Projeto "${name}" removido do registro (grafos intactos).`);
}

async function scan(name) {
  if (!name) throw new Error('uso: kb project scan <nome>');
  const config = await loadConfig();
  const p = getProject(config, name);
  if (!p) throw new Error(`projeto "${name}" não registrado`);
  const { isMono, candidates } = detectSubprojects(expandPath(p.path), name);
  if (isMono && candidates.length) {
    p.monorepo = true;
    p.subprojects = candidates;
    await saveConfig(config);
    console.log(`Re-escaneado: ${candidates.length} subprojeto(s) registrados.`);
    for (const s of candidates) console.log(`  └ ${s.name}  (${s.subpath})`);
  } else {
    console.log('Nenhum subprojeto detectado (projeto simples).');
  }
}
