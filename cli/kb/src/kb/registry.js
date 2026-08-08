import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { slugify } from './note.js';

const PKG_MARKERS = [
  'package.json',
  'pyproject.toml',
  'pubspec.yaml',
  'Cargo.toml',
  'go.mod',
  'flake.nix',
];
const WORKSPACE_DIRS = ['apps', 'packages', 'services', 'libs', 'modules'];

function hasPackageMarker(dir) {
  return PKG_MARKERS.some(m => existsSync(join(dir, m)));
}

// Detecta se é monorepo e devolve candidatos a subprojeto: [{ name, subpath }].
export function detectSubprojects(repoRoot, projectName) {
  const monoMarkers = ['pnpm-workspace.yaml', 'nx.json', 'turbo.json', 'lerna.json'];
  let isMono = monoMarkers.some(m => existsSync(join(repoRoot, m)));

  // package.json com "workspaces" também indica monorepo.
  const rootPkg = join(repoRoot, 'package.json');
  if (existsSync(rootPkg)) {
    try {
      const pkg = JSON.parse(readFileSync(rootPkg, 'utf8'));
      if (pkg.workspaces) isMono = true;
    } catch {
      /* ignora package.json inválido */
    }
  }

  const candidates = [];
  for (const wd of WORKSPACE_DIRS) {
    const wdPath = join(repoRoot, wd);
    if (!existsSync(wdPath)) continue;
    let entries;
    try {
      entries = readdirSync(wdPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const subpath = `${wd}/${e.name}`;
      if (hasPackageMarker(join(wdPath, e.name))) {
        candidates.push({ name: `${slugify(projectName)}-${slugify(e.name)}`, subpath });
      }
    }
  }
  if (candidates.length > 1) isMono = true;
  return { isMono, candidates };
}

export function upsertVault(config, vault) {
  config.vaults ??= [];
  const i = config.vaults.findIndex(v => v.name === vault.name);
  if (i >= 0) config.vaults[i] = { ...config.vaults[i], ...vault };
  else config.vaults.push(vault);
  // Garante exatamente um default.
  if (vault.default) {
    for (const v of config.vaults) if (v.name !== vault.name) delete v.default;
  } else if (!config.vaults.some(v => v.default)) {
    config.vaults[0].default = true;
  }
  return config;
}

export function removeVault(config, name) {
  config.vaults = (config.vaults ?? []).filter(v => v.name !== name);
  if (config.vaults.length && !config.vaults.some(v => v.default)) {
    config.vaults[0].default = true;
  }
  return config;
}

export function upsertProject(config, project) {
  config.projects ??= [];
  const i = config.projects.findIndex(p => p.name === project.name);
  if (i >= 0) config.projects[i] = { ...config.projects[i], ...project };
  else config.projects.push(project);
  return config;
}

export function removeProject(config, name) {
  config.projects = (config.projects ?? []).filter(p => p.name !== name);
  // Remove de qualquer grupo também.
  for (const g of config.groups ?? []) {
    g.members = (g.members ?? []).filter(m => m !== name && !m.startsWith(`${name}#`));
  }
  return config;
}

export function upsertGroup(config, group) {
  config.groups ??= [];
  const i = config.groups.findIndex(g => g.name === group.name);
  if (i >= 0) config.groups[i] = { ...config.groups[i], ...group };
  else config.groups.push({ members: [], ...group });
  return config;
}

// Valida que cada membro existe como repo ou subprojeto registrado.
// Aceita: "repo", "subprojeto-name", "repo#subproj-name" e "repo#base"
// (base = nome do subprojeto sem o prefixo "<repo>-").
export function validateMembers(config, members) {
  const known = new Set();
  for (const p of config.projects ?? []) {
    known.add(p.name);
    for (const sp of p.subprojects ?? []) {
      known.add(sp.name);
      known.add(`${p.name}#${sp.name}`);
      const base = sp.name.startsWith(`${p.name}-`) ? sp.name.slice(p.name.length + 1) : sp.name;
      known.add(`${p.name}#${base}`);
    }
  }
  for (const v of config.vaults ?? []) known.add(v.name);
  const missing = members.filter(m => !known.has(m));
  if (missing.length) {
    throw new Error(`membros não registrados: ${missing.join(', ')} (rode "kb project add" antes)`);
  }
}
