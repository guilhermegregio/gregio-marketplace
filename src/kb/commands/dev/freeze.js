import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { loadConfig, getVault, defaultVault, getProject } from '../../config.js';
import { expandPath } from '../../paths.js';
import { merge } from '../../frontmatter.js';
import { driftedFiles, freeze, readIndex, unfreeze } from '../../freeze.js';
import { loadPlan } from './plan.js';

// kb dev freeze <slug> [--vault n]                    congela os contratos do plano
// kb dev unfreeze <slug> [--file p] --reason "..."    descongela (exige justificativa)
//
// Os contratos são declarados no _plan.md:
//   contracts:
//     - /caminho/apps/white-label/behaviors.feature
// Caminho relativo é resolvido a partir do repo do projeto (frontmatter `projects`)
// ou do cwd.

export async function runFreeze({ positionals, opts }) {
  const slug = positionals[0];
  if (!slug) throw new Error('uso: kb dev freeze <slug> [--vault n]');

  const config = await loadConfig();
  const vault = opts.vault ? getVault(config, opts.vault) : defaultVault(config);
  const { dir, plan } = await loadPlan(expandPath(vault.path), slug);

  const declared = plan.frontmatter?.contracts ?? [];
  if (!declared.length) {
    throw new Error(
      `plano "${slug}" não declara contratos.\n` +
      'Adicione ao _plan.md:\n  contracts:\n    - <path do behaviors.feature>',
    );
  }

  const files = declared.map(p => resolveContract(config, plan, p));
  const entries = await freeze({ plan: slug, vault: vault.name, files });

  // O plano guarda o registro humano; o índice guarda o hash para o hook.
  await writeFile(
    `${dir}/_plan.md`,
    merge(await readFile(`${dir}/_plan.md`, 'utf8'), {
      contracts_frozen_at: new Date().toISOString().slice(0, 10),
      updated: new Date().toISOString().slice(0, 10),
    }),
  );

  console.log(`🧊 ${entries.length} contrato(s) congelado(s) no plano ${slug}:`);
  for (const e of entries) console.log(`   ${e.file}  (${e.sha})`);
  console.log('\nA partir daqui o contrato manda: cenário quebrando = código errado.');
  console.log('Precisa mudar o comportamento? `kb dev unfreeze` com justificativa.');
}

export async function runUnfreeze({ positionals, opts }) {
  const slug = positionals[0];
  if (!slug) throw new Error('uso: kb dev unfreeze <slug> [--file p] --reason "por quê"');
  if (!opts.reason) {
    throw new Error(
      'unfreeze exige --reason: mudar contrato é decisão de produto, não de implementação.\n' +
      'Ex.: kb dev unfreeze meu-plano --reason "cenário 4 assumia 1 plano por aluno"',
    );
  }

  const config = await loadConfig();
  const vault = opts.vault ? getVault(config, opts.vault) : defaultVault(config);
  const { dir, plan } = await loadPlan(expandPath(vault.path), slug);
  const file = opts.file ? resolveContract(config, plan, opts.file) : null;

  const removed = await unfreeze({ plan: slug, vault: vault.name, file });
  if (!removed) {
    console.log(`nada congelado para ${slug}${file ? ` (${file})` : ''}.`);
    return;
  }

  // Rastro no plano: por que o contrato mudou fica com o plano, não na cabeça de ninguém.
  const planPath = `${dir}/_plan.md`;
  const raw = await readFile(planPath, 'utf8');
  const entry = `\n## Unfreeze ${new Date().toISOString().slice(0, 10)}\n\n` +
    `- **arquivo:** ${file ?? '(todos)'}\n- **motivo:** ${opts.reason}\n`;
  await writeFile(planPath, merge(raw + entry, { updated: new Date().toISOString().slice(0, 10) }));

  console.log(`🔓 ${removed} contrato(s) descongelado(s). Motivo registrado no _plan.md.`);
  console.log('Recongele com `kb dev freeze` depois de ajustar o contrato.');
}

/** `kb dev frozen [--slug s]` — o que está congelado e o que saiu do lugar. */
export async function runFrozen({ opts }) {
  const index = await readIndex();
  const entries = opts.slug ? index.entries.filter(e => e.plan === opts.slug) : index.entries;
  if (!entries.length) {
    console.log('nenhum contrato congelado.');
    return;
  }
  console.log(`${entries.length} contrato(s) congelado(s):`);
  for (const e of entries) console.log(`  [${e.plan}] ${e.file}`);

  const drift = await driftedFiles(opts.slug ?? null);
  if (drift.length) {
    console.log(`\n⚠️  ${drift.length} contrato(s) fora do congelado:`);
    for (const d of drift) console.log(`  ${d.file} — ${d.reason}`);
    console.log('\nIsto é o alarme: ou o contrato foi editado sem unfreeze, ou o');
    console.log('unfreeze não foi seguido de `kb dev freeze`.');
    process.exitCode = 1;
  }
}

function resolveContract(config, plan, p) {
  if (isAbsolute(p)) return p;
  const projects = plan.frontmatter?.projects ?? [];
  for (const name of projects) {
    const proj = getProject(config, name);
    if (proj) return resolve(expandPath(proj.path), p);
  }
  return resolve(process.cwd(), p);
}
