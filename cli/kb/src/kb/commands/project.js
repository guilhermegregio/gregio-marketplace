import { existsSync } from 'node:fs';
import { loadConfig, saveConfig, getProject } from '../config.js';
import { upsertProject, removeProject, upsertGroup, detectSubprojects } from '../registry.js';
import { expandPath } from '../paths.js';
import { asList } from '../args.js';
import { applyHygiene, installHook } from '../repo-hygiene.js';
import { linkClaudeMd, resolveVaultTarget, targetLabel } from '../repo-claudemd.js';
import { moveProject } from '../project-move.js';
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
    case 'link-claude':
      return linkClaude(positionals[1], opts);
    case 'move':
      return moveProject(positionals[1], opts);
    default:
      console.error('uso: kb project <add|list|remove|scan|init-hygiene|link-claude|move>');
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
    // Raiz de um monorepo: allowlist reduzida (não versiona o merge da raiz).
    const monorepoRoot = project.monorepo === true && t === root;
    const { stack } = await applyHygiene(t, { monorepoRoot });
    const hook = await installHook(t);
    const rel = t === root ? '(raiz)' : t.slice(root.length + 1);
    console.log(`  hygiene ${rel}: .graphifyignore[${stack ?? 'genérico'}] + allowlist + gitattributes` +
      (hook.ok ? ' + hook' : ' (hook: graphify indisponível, pulado)'));
  }
}

async function add(pathArg, opts) {
  if (!pathArg) {
    throw new Error('uso: kb project add <path> [--name n] [--group g] [--vault v] [--no-scan] [--subproject sub]');
  }
  const path = expandPath(pathArg);
  if (!existsSync(path)) throw new Error(`path não existe: ${path}`);

  const config = await loadConfig({ required: false });
  const name = opts.name || basename(path);

  // --vault: vault da casa do projeto. Validado antes de qualquer escrita — um nome
  // errado gravado na config faria o link-claude cair silenciosamente no fallback.
  if (opts.vault !== undefined) {
    const names = (config.vaults ?? []).map(v => v.name);
    if (opts.vault === true || !names.includes(opts.vault)) {
      throw new Error(`vault "${opts.vault === true ? '' : opts.vault}" desconhecido — válidos: ${names.join(', ') || '(nenhum)'}`);
    }
  }

  const existing = getProject(config, name);
  const project = { name, path, graphOut: 'graphify-out/graph.json', includeInCentral: true };
  if (opts.vault !== undefined) project.vault = opts.vault;

  // Re-add preserva o que já foi curado (subprojetos renomeados, grupos): só re-detecta
  // subprojetos se o projeto é novo ou se vieram --subproject explícitos.
  const explicitSubs = asList(opts.subproject);
  const rescan = opts['no-scan'] !== true && (!existing || explicitSubs.length > 0);

  if (rescan) {
    const { isMono, candidates } = detectSubprojects(path, name);
    let subs = [];
    if (explicitSubs.length) {
      subs = explicitSubs.map(sp => ({ name: `${name}-${basename(sp)}`, subpath: sp }));
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
  console.log(`Projeto "${name}" ${existing ? 'atualizado' : 'registrado'}.`);
  if (project.vault) {
    const target = resolveVaultTarget(config, getProject(config, name));
    console.log(`Casa no vault: ${targetLabel(target)} (ponteiro: kb project link-claude ${name})`);
  }

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

// Materializa/atualiza o bloco de cross-link repo↔vault no CLAUDE.md dos repos
// registrados (idempotente). Monorepo: linka só o CLAUDE.md da raiz.
async function linkClaude(name, opts) {
  const config = await loadConfig();
  let targets;
  if (opts.all === true) {
    targets = config.projects ?? [];
  } else if (name) {
    const p = getProject(config, name);
    if (!p) throw new Error(`projeto "${name}" não registrado (veja "kb project list")`);
    targets = [p];
  } else {
    throw new Error('uso: kb project link-claude <nome> | --all');
  }
  for (const p of targets) {
    const root = expandPath(p.path);
    if (!existsSync(root)) {
      console.warn(`  ! ${p.name}: path ausente — pulando`);
      continue;
    }
    const { target, changed } = await linkClaudeMd(root, config, p);
    console.log(
      `  ${p.name} → vault-${target.vaultName}/10-projects/${target.folder}/  ` +
        (changed ? '(escrito)' : '(inalterado)'),
    );
  }
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
