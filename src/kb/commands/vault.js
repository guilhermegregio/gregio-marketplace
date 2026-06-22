import { mkdir, symlink, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig, saveConfig, validateConfig } from '../config.js';
import { upsertVault, removeVault } from '../registry.js';
import { scaffoldVault, listScaffoldFiles, fileMtime } from '../templates.js';
import { expandPath, VAULT_SKELETON } from '../paths.js';

export async function run({ positionals, opts }) {
  const sub = positionals[0];
  switch (sub) {
    case 'list':
      return list();
    case 'new':
      return create(positionals[1], opts);
    case 'register':
      return register(positionals[1], opts);
    case 'unregister':
      return unregister(positionals[1]);
    case 'sync':
      return sync(opts);
    case 'aggregator':
      return aggregator(positionals[1] ?? 'build', opts);
    default:
      console.error('uso: kb vault <list|new|register|unregister|sync>');
      process.exit(1);
  }
}

async function list() {
  const config = await loadConfig({ required: false });
  console.log('Vaults:');
  for (const v of config.vaults ?? []) {
    const mark = v.default ? ' *' : '  ';
    const ok = existsSync(expandPath(v.path)) ? '' : '  (path ausente!)';
    console.log(`${mark} ${v.name}  [${v.visibility ?? '?'}]  ${v.path}${ok}`);
  }
  if (!(config.vaults ?? []).length) console.log('  (nenhum)');

  console.log('\nProjetos:');
  for (const p of config.projects ?? []) {
    const subs = p.subprojects?.length ? `  (${p.subprojects.length} subprojetos)` : '';
    console.log(`   ${p.name}  ${p.path}${subs}`);
    for (const sp of p.subprojects ?? []) console.log(`      └ ${sp.name}  (${sp.subpath})`);
  }
  if (!(config.projects ?? []).length) console.log('  (nenhum)');

  console.log('\nGrupos:');
  for (const g of config.groups ?? []) {
    console.log(`   ${g.name}  →  ${(g.members ?? []).join(', ') || '(vazio)'}`);
  }
  if (!(config.groups ?? []).length) console.log('  (nenhum)');
}

async function create(name, opts) {
  if (!name) throw new Error('uso: kb vault new <nome> [--visibility v] [--path p]');
  const config = await loadConfig({ required: false });
  const visibility = opts.visibility || config.defaults?.visibility || 'private';
  const path = opts.path ? expandPath(opts.path) : expandPath(join('~/code', `vault-${name}`));
  if (existsSync(path)) throw new Error(`destino já existe: ${path}`);

  console.log(`Criando vault "${name}" em ${path} ...`);
  await scaffoldVault(path, { vaultName: name, visibility });

  // git init (sem commitar — o usuário decide).
  spawnSync('git', ['init', '-q'], { cwd: path });

  upsertVault(config, {
    name,
    path,
    visibility,
    graphOut: 'graphify-out/graph.json',
    includeInCentral: true,
    default: opts.default === true || (config.vaults ?? []).length === 0,
  });
  validateConfig(config);
  await saveConfig(config);
  console.log(`Vault "${name}" criado e registrado. Rode "git add . && git commit" dentro de ${path}.`);
}

async function register(name, opts) {
  if (!name || !opts.path) throw new Error('uso: kb vault register <nome> --path <p> [--visibility v]');
  const config = await loadConfig({ required: false });
  upsertVault(config, {
    name,
    path: expandPath(opts.path),
    visibility: opts.visibility || config.defaults?.visibility || 'private',
    graphOut: 'graphify-out/graph.json',
    includeInCentral: true,
  });
  validateConfig(config);
  await saveConfig(config);
  console.log(`Vault "${name}" registrado.`);
}

async function unregister(name) {
  if (!name) throw new Error('uso: kb vault unregister <nome>');
  const config = await loadConfig();
  removeVault(config, name);
  await saveConfig(config);
  console.log(`Vault "${name}" removido do registro (arquivos intactos).`);
}

// Compara 00-meta + *.base de cada vault contra o skeleton canônico.
async function sync(opts) {
  const config = await loadConfig();
  const apply = opts.apply === true;
  const files = await listScaffoldFiles(VAULT_SKELETON);
  let drift = 0;
  for (const v of config.vaults ?? []) {
    const root = expandPath(v.path);
    for (const rel of files) {
      const src = join(VAULT_SKELETON, rel);
      const dst = join(root, rel);
      const srcM = await fileMtime(src);
      const dstM = await fileMtime(dst);
      if (!existsSync(dst) || srcM > dstM) {
        drift++;
        console.log(`${apply ? 'atualizar' : 'drift'}: ${v.name}/${rel}`);
        if (apply) {
          await mkdir(dirname(dst), { recursive: true });
          await cp(src, dst);
        }
      }
    }
  }
  if (!drift) console.log('Todos os vaults em dia com o skeleton.');
  else if (!apply) console.log(`\n${drift} arquivo(s) com drift. Rode "kb vault sync --apply" e revise/commite em cada vault.`);
}

// Monta o vault agregador: vault-all/ com um mount por vault registrado.
async function aggregator(action, opts) {
  const config = await loadConfig();
  const mode = opts.mode || 'symlink';
  const aggPath = opts.path ? expandPath(opts.path) : expandPath('~/code/vault-all');
  await mkdir(aggPath, { recursive: true });
  await mkdir(join(aggPath, '.obsidian'), { recursive: true });

  for (const v of config.vaults ?? []) {
    const target = expandPath(v.path);
    const linkPath = join(aggPath, v.name);
    if (existsSync(linkPath)) await rm(linkPath, { recursive: true, force: true });
    if (mode === 'symlink') {
      await symlink(target, linkPath, 'dir');
      console.log(`  ${v.name} -> ${target}`);
    } else if (mode === 'submodule') {
      spawnSync('git', ['submodule', 'add', target, v.name], { cwd: aggPath, stdio: 'inherit' });
    } else {
      throw new Error(`modo inválido: ${mode} (use symlink|submodule)`);
    }
  }
  console.log(`Agregador ${action === 'refresh' ? 'atualizado' : 'criado'} em ${aggPath}. Abra-o no Obsidian.`);
  if (mode === 'symlink') {
    console.log('Lembre: vault-all/ é local — não compartilhe (mistura todas as visibilidades).');
  }
}
