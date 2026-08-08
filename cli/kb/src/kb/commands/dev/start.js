import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, getVault, defaultVault } from '../../config.js';
import { expandPath, ENGINE_ROOT } from '../../paths.js';
import { renderTokens } from '../../templates.js';
import { today } from '../../note.js';

// kb dev start <slug> --vault <n> --project <repo> [--title t] [--ui] [--no-contract]
// Scaffolda 30-plans/<slug>/{_plan.md, tasks/, execution/} a partir do plan-skeleton.
//
// devflow v2: o plano nasce com as tasks-gate do fluxo
//   spec → prototype ⛔ → behaviors ⛔🧊 → code → review → finish
// `--ui` acrescenta a task de protótipo (fluxo com tela); `--no-contract` pula a task
// de behaviors (plano sem comportamento observável — refactor puro, doc, infra).
export async function run({ positionals, opts }) {
  const slug = positionals[0];
  if (!slug) throw new Error('uso: kb dev start <slug> --vault <n> --project <repo> [--title "..."]');

  const config = await loadConfig();
  const vault = opts.vault ? getVault(config, opts.vault) : defaultVault(config);
  const root = expandPath(vault.path);
  const dir = join(root, '30-plans', slug);
  if (existsSync(dir)) throw new Error(`plano já existe: ${dir}`);

  const tokens = {
    SLUG: slug,
    TITLE: opts.title || slug,
    PROJECT: opts.project || '',
    VAULT_NAME: vault.name,
    VISIBILITY: vault.visibility || config.defaults?.visibility || 'private',
    DATE: today(),
  };

  const skel = join(ENGINE_ROOT, 'templates', 'plan-skeleton');
  if (!existsSync(skel)) throw new Error(`plan-skeleton ausente em ${skel}`);

  await mkdir(join(dir, 'tasks'), { recursive: true });
  await mkdir(join(dir, 'execution'), { recursive: true });

  // _plan.md
  await writeFile(join(dir, '_plan.md'), renderTokens(await readFile(join(skel, '_plan.md'), 'utf8'), tokens));
  // tasks/_task.md (modelo, com id T01) — o autor duplica para T02, T03, ...
  const taskSkel = join(skel, 'tasks');
  if (existsSync(taskSkel)) {
    for (const f of await readdir(taskSkel)) {
      await writeFile(join(dir, 'tasks', f), renderTokens(await readFile(join(taskSkel, f), 'utf8'), tokens));
    }
  }

  // Tasks-gate do devflow v2. Ids TP/TB são propositalmente fora da sequência
  // numérica: são estágios do fluxo, não itens de trabalho paralelizáveis.
  const stagesDir = join(skel, 'stages');
  const staged = [];
  if (existsSync(stagesDir)) {
    if (opts.ui) {
      await writeFile(join(dir, 'tasks', 'TP.md'), renderTokens(await readFile(join(stagesDir, 'prototype.md'), 'utf8'), tokens));
      staged.push('TP (protótipo ⛔)');
    }
    if (opts['no-contract'] !== true) {
      let tb = renderTokens(await readFile(join(stagesDir, 'behaviors.md'), 'utf8'), tokens);
      if (!opts.ui) tb = tb.replace('depends_on: [TP]', 'depends_on: []');
      await writeFile(join(dir, 'tasks', 'TB.md'), tb);
      staged.push('TB (contrato ⛔🧊)');
    }
  }

  console.log(`Plano criado: ${dir} (status: draft)`);
  if (staged.length) console.log(`Tasks-gate: ${staged.join(', ')} — as tasks de código dependem delas.`);
  console.log('Edite _plan.md + tasks/, troque para status: ready-for-review e pare para revisão (gate de handoff).');
}
