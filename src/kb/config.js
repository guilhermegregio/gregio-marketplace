import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync, accessSync, constants } from 'node:fs';
import { join, delimiter } from 'node:path';
import { CONFIG_PATH, CONFIG_DIR, ENGINE_ROOT, expandPath } from './paths.js';

const DEFAULT_CONFIG = {
  version: 1,
  central: { graphOut: 'auto', pythonInterp: 'auto' },
  defaults: { visibility: 'private', category: 'article' },
  vaults: [],
  groups: [],
  projects: [],
};

// Busca um executável no PATH (nativo, sem depender de `which`).
function findOnPath(cmd) {
  const dirs = (process.env.PATH || '').split(delimiter);
  for (const dir of dirs) {
    if (!dir) continue;
    const p = join(dir, cmd);
    try {
      accessSync(p, constants.X_OK);
      return p;
    } catch {
      /* segue procurando */
    }
  }
  return null;
}

// Resolve o interpretador Python que consegue importar o graphify (para o MCP serve
// e o ingest). Ordem: config explícita → marker do graphify-out (se existir) →
// shebang do binário `graphify` no PATH → python3.
export function resolvePythonInterp(config) {
  const want = config?.central?.pythonInterp ?? 'auto';
  if (want && want !== 'auto') return expandPath(want);

  const marker = join(ENGINE_ROOT, 'graphify-out', '.graphify_python');
  if (existsSync(marker)) return readFileSync(marker, 'utf8').trim();

  // Deriva do shebang do binário `graphify` no PATH (instalado via nix/uv/pipx).
  try {
    const bin = findOnPath('graphify');
    if (bin) {
      const shebang = readFileSync(bin, 'utf8').split('\n', 1)[0];
      const m = shebang.match(/^#!\s*(\S+)/);
      if (m && /^[\w/.\-]+$/.test(m[1])) return m[1];
    }
  } catch {
    /* graphify não está no PATH — cai no fallback */
  }
  return 'python3';
}

export async function loadConfig({ required = true } = {}) {
  if (!existsSync(CONFIG_PATH)) {
    if (required) {
      throw new Error(
        `config não encontrada em ${CONFIG_PATH}.\n` +
          'Rode "kb vault new <nome>" (cria a config) ou copie kb.config.example.json para lá.',
      );
    }
    return structuredClone(DEFAULT_CONFIG);
  }
  let raw;
  try {
    raw = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  } catch (e) {
    throw new Error(`config inválida (${CONFIG_PATH}): ${e.message}`);
  }
  return { ...structuredClone(DEFAULT_CONFIG), ...raw };
}

export async function saveConfig(config) {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

// Validação estrutural. Lança no primeiro erro com mensagem clara.
export function validateConfig(config) {
  const names = new Set();
  let defaults = 0;
  for (const v of config.vaults ?? []) {
    if (!v.name || !v.path) throw new Error('vault sem name/path no kb.config.json');
    if (names.has(v.name)) throw new Error(`nome de vault duplicado: ${v.name}`);
    names.add(v.name);
    if (v.default) defaults++;
  }
  if ((config.vaults ?? []).length > 0 && defaults !== 1) {
    throw new Error(`exatamente um vault deve ter "default": true (achei ${defaults})`);
  }
  const projNames = new Set();
  for (const p of config.projects ?? []) {
    if (!p.name || !p.path) throw new Error('projeto sem name/path no kb.config.json');
    if (projNames.has(p.name)) throw new Error(`nome de projeto duplicado: ${p.name}`);
    projNames.add(p.name);
  }
  for (const g of config.groups ?? []) {
    if (!g.name) throw new Error('grupo sem name no kb.config.json');
  }
  return config;
}

export function getVault(config, name) {
  const v = (config.vaults ?? []).find(x => x.name === name);
  if (!v) throw new Error(`vault "${name}" não registrado (veja "kb vault list")`);
  return v;
}

export function defaultVault(config) {
  const v = (config.vaults ?? []).find(x => x.default) ?? (config.vaults ?? [])[0];
  if (!v) throw new Error('nenhum vault registrado (rode "kb vault new <nome>")');
  return v;
}

export function getProject(config, name) {
  return (config.projects ?? []).find(x => x.name === name);
}

export function getGroup(config, name) {
  return (config.groups ?? []).find(x => x.name === name);
}

// Expande vaults + projetos (e subprojetos) em fontes de extração para o grafo central.
// Cada fonte: { repo, root, graphOut, kind, visibility? }
export function graphSources(config, { onlyRepos = null } = {}) {
  const sources = [];
  for (const v of config.vaults ?? []) {
    if (v.includeInCentral === false) continue;
    sources.push({
      repo: v.name,
      kind: 'vault',
      root: expandPath(v.path),
      graphOut: v.graphOut ?? 'graphify-out/graph.json',
      visibility: v.visibility ?? config.defaults?.visibility,
    });
  }
  for (const p of config.projects ?? []) {
    if (p.includeInCentral === false) continue;
    const base = expandPath(p.path);
    if (p.monorepo && Array.isArray(p.subprojects) && p.subprojects.length) {
      for (const sp of p.subprojects) {
        if (sp.includeInCentral === false) continue;
        sources.push({
          repo: sp.name,
          kind: 'subproject',
          parent: p.name,
          root: join(base, sp.subpath),
          graphOut: sp.graphOut ?? 'graphify-out/graph.json',
        });
      }
    } else {
      sources.push({
        repo: p.name,
        kind: 'project',
        root: base,
        graphOut: p.graphOut ?? 'graphify-out/graph.json',
      });
    }
  }
  if (onlyRepos) {
    const set = new Set(onlyRepos);
    return sources.filter(s => set.has(s.repo));
  }
  return sources;
}

// Resolve um grupo para a lista de repos (nomes de fonte) que ele agrega.
// Membros podem ser "repo" ou "repo#subproj" -> normaliza para o nome de fonte.
export function groupRepos(config, groupName) {
  const g = getGroup(config, groupName);
  if (!g) throw new Error(`grupo "${groupName}" não existe (veja "kb group list")`);
  return (g.members ?? []).map(m => (m.includes('#') ? m.split('#')[1] : m));
}
