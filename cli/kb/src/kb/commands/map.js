import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../config.js';
import { CONFIG_PATH, expandPath } from '../paths.js';
import { findRepos } from '../repo-status.js';
import { claudeMdPointsTo, houseFaces, resolveVaultTarget, targetLabel } from '../repo-claudemd.js';
import { unlistedHouses } from '../vault-index.js';

// `kb map [dir]` — o que falta para o harness enxergar repo → kb → vault.
//
// Duas seções:
//  - **não registrados**: repos git de `~/code` fora do kb;
//  - **cobertura**: por projeto registrado — path vivo, casa em algum vault, ponteiro
//    `kb:link` no CLAUDE.md apontando para a casa resolvida, casa em vários vaults sem
//    `vault` na config (a resolução passa a depender da ordem dos vaults) e casa fora
//    do `10-projects/_index.md`.
//
// Só sugere, nunca executa: registrar repo, escolher o vault da casa e mexer em índice
// são decisões do humano — tem repo de terceiro, clone temporário e experimento que não
// devem entrar no grafo central. Cada ✗ sai com o comando de correção pronto.
//
// Exit 1 se houver ✗ na cobertura (automação lê o exit code). Repo não registrado não
// é ✗: ficar fora do kb é uma escolha legítima.

const home = homedir();
const tilde = p => (p === home || p.startsWith(`${home}/`) ? `~${p.slice(home.length)}` : p);

export async function run({ positionals }) {
  const codeDir = expandPath(positionals[0] ?? join(home, 'code'));
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
  } else {
    console.log('\nnão registrados:');
    for (const r of missing) console.log(`  ${r}\n    → kb project add ${r}`);
  }

  const failures = coverage(config);
  if (failures) {
    console.log(`\n✗ ${failures} pendência(s) de cobertura`);
    process.exitCode = 1;
  } else {
    console.log('\n✓ tudo mapeado');
  }
}

// Imprime a seção "cobertura" e devolve quantos ✗ encontrou.
function coverage(config) {
  const projects = config.projects ?? [];
  const vaults = config.vaults ?? [];
  let failures = 0;
  const ok = msg => console.log(`  ✓ ${msg}`);
  const fail = (msg, fix) => {
    failures++;
    console.log(`  ✗ ${msg}\n    → ${fix}`);
  };

  console.log(`\ncobertura (${projects.length} projeto(s), ${vaults.length} vault(s)):`);
  if (!vaults.length) {
    fail('nenhum vault registrado', 'kb vault new <nome>');
    return failures;
  }

  for (const p of projects) {
    const root = expandPath(p.path);
    if (!existsSync(root)) {
      fail(`${p.name} — path não existe`, `kb project remove ${p.name}`);
      continue;
    }

    if (p.vault && !vaults.some(v => v.name === p.vault)) {
      fail(
        `${p.name} — vault: "${p.vault}" na config não é um vault registrado`,
        `kb project add ${tilde(root)} --vault <${vaults.map(v => v.name).join('|')}>`,
      );
      continue;
    }

    const faces = houseFaces(config, p);
    const target = resolveVaultTarget(config, p);
    const label = targetLabel(target);

    if (!faces.length) {
      fail(
        `${p.name} — sem casa em nenhum vault`,
        `kb new --vault ${target.vaultName} --type project --title "${p.name}" --project ${target.folder}`,
      );
      continue;
    }

    const face = faces.find(f => f.vaultName === target.vaultName && f.folder === target.folder);
    if (!face) {
      // vault: explícito, mas a casa está em outro vault.
      fail(
        `${p.name} — vault: ${p.vault} na config, mas a casa está em ${faces.map(f => f.vaultName).join(', ')}`,
        `kb project move ${p.name} --to-vault ${p.vault}`,
      );
      continue;
    }
    if (!face.hasProject) {
      fail(
        `${p.name} — ${label} sem _project.md`,
        `kb new --vault ${target.vaultName} --type project --title "${p.name}" --project ${target.folder}`,
      );
      continue;
    }

    const others = faces.filter(f => f !== face).map(f => f.vaultName);
    if (others.length && !p.vault) {
      const all = faces.map(f => f.vaultName);
      const defaultName = (vaults.find(v => v.default) ?? vaults[0]).name;
      // Sugere a face com _project.md fora do vault default: o default é o fallback, a
      // face "especializada" costuma ser a casa de verdade. O humano confirma.
      const suggest =
        faces.find(f => f.hasProject && f.vaultName !== defaultName)?.vaultName ?? face.vaultName;
      fail(
        `${p.name} — casa em ${all.length} vaults (${all.join(', ')}) sem vault: na config`,
        `kb project add ${tilde(root)} --vault ${suggest}`,
      );
      continue;
    }

    if (!claudeMdPointsTo(root, target)) {
      fail(`${p.name} — CLAUDE.md sem ponteiro para ${label}`, `kb project link-claude ${p.name}`);
      continue;
    }

    ok(`${p.name} — ${label}${others.length ? ` · faces em ${others.join(', ')}` : ''}`);
  }

  for (const v of vaults) {
    const root = expandPath(v.path);
    if (!existsSync(root)) {
      fail(`vault ${v.name} — path não existe (${v.path})`, `kb vault unregister ${v.name}`);
      continue;
    }
    const unlisted = unlistedHouses(root);
    if (unlisted.length) {
      fail(`vault ${v.name} — 10-projects/_index.md não lista: ${unlisted.join(', ')}`, `kb vault index --vault ${v.name}`);
    } else {
      ok(`vault ${v.name} — 10-projects/_index.md em dia`);
    }
  }
  return failures;
}
