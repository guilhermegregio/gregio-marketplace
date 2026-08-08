import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../config.js';
import { CONFIG_PATH, expandPath } from '../paths.js';
import { findRepos } from '../repo-status.js';

// `kb map [dir]` — repos git de `~/code` que ainda não estão no kb.
//
// Só sugere (`kb project add <path>`), nunca executa: registrar repo é decisão do
// humano — tem repo de terceiro, clone temporário e experimento que não devem entrar
// no grafo central.

export async function run({ positionals }) {
  const codeDir = expandPath(positionals[0] ?? join(homedir(), 'code'));
  const repos = findRepos(codeDir);

  // Registrado = project OU vault do kb (vault é repo git, mas não é "project").
  const config = await loadConfig({ required: false });
  if (!existsSync(CONFIG_PATH)) {
    console.error(`✗ kb config não encontrado em ${CONFIG_PATH} — tudo aparecerá como não registrado`);
  }
  const registered = new Set([
    ...(config.projects ?? []).map(p => expandPath(p.path)),
    ...(config.vaults ?? []).map(v => expandPath(v.path)),
  ]);

  const missing = repos.filter(r => !registered.has(r));
  console.log(`repos git em ${codeDir}: ${repos.length} (${repos.length - missing.length} registrados no kb)`);
  if (!missing.length) {
    console.log('✓ todos registrados');
    return;
  }
  console.log('\nnão registrados:');
  for (const r of missing) console.log(`  ${r}\n    → kb project add ${r}`);
}
