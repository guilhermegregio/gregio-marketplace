import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { loadConfig, getVault, defaultVault, getProject } from '../../config.js';
import { expandPath, ENGINE_ROOT } from '../../paths.js';
import { renderTokens } from '../../templates.js';
import { buildFrontmatter, today } from '../../note.js';
import { parse, stringify } from '../../frontmatter.js';
import { behaviorsDir, projectsRoot } from '../../contracts.js';

// kb dev start <slug> --vault <n> --project <repo> [--title t] [--ui] [--no-contract]
// Scaffolda 30-plans/<slug>/{_plan.md, tasks/, execution/} a partir do plan-skeleton.
//
// devflow v2: o plano nasce com as tasks-gate do fluxo
//   spec → prototype ⛔ → behaviors ⛔🧊 → code → review → finish
// `--ui` acrescenta a task de protótipo (fluxo com tela); `--no-contract` pula a task
// de behaviors (plano sem comportamento observável — refactor puro, doc, infra).
//
// Com contrato, o start garante a casa do projeto no vault
// (<vault>/10-projects/<project>/behaviors/) — é lá que o .feature da TB vai morar.
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
    VAULT_DIR: basename(root),
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
  const house = opts['no-contract'] !== true && opts.project
    ? await ensureProjectHouse({ config, vault, project: opts.project })
    : null;

  const stagesDir = join(skel, 'stages');
  const staged = [];
  if (existsSync(stagesDir)) {
    if (opts.ui) {
      await writeFile(join(dir, 'tasks', 'TP.md'), renderTokens(await readFile(join(stagesDir, 'prototype.md'), 'utf8'), tokens));
      staged.push('TP (protótipo ⛔)');
    }
    if (opts['no-contract'] !== true) {
      let tb = renderTokens(
        await readFile(join(stagesDir, 'behaviors.md'), 'utf8'),
        { ...tokens, PROJECT: tokens.PROJECT || '<projeto>' },
      );
      if (!opts.ui) tb = tb.replace('depends_on: [TP]', 'depends_on: []');
      await writeFile(join(dir, 'tasks', 'TB.md'), tb);
      staged.push('TB (contrato ⛔🧊)');
    }
  }

  console.log(`Plano criado: ${dir} (status: draft)`);
  if (house?.created) console.log(`Casa do projeto criada no vault: ${house.projectFile} (template de projeto)`);
  if (house) console.log(`Contratos do plano: ${house.behaviors}/<escopo>.feature`);
  if (staged.length) console.log(`Tasks-gate: ${staged.join(', ')} — as tasks de código dependem delas.`);
  console.log('Edite _plan.md + tasks/, troque para status: ready-for-review e pare para revisão (gate de handoff).');
}

/**
 * Garante <vault>/10-projects/<project>/behaviors/. Casa sem _project.md ganha um, pelo
 * mesmo template do `kb new --type project` — contrato sem casa vira arquivo órfão que
 * nenhum índice do vault enxerga.
 */
async function ensureProjectHouse({ config, vault, project }) {
  const home = join(projectsRoot(vault), project);
  const projectFile = join(home, '_project.md');
  const behaviors = behaviorsDir(vault, project);
  let created = false;

  if (!existsSync(projectFile)) {
    if (!getProject(config, project)) {
      process.stderr.write(`⚠️  projeto "${project}" não está registrado no kb (kb project add <path>).\n`);
    }
    const fm = buildFrontmatter({
      vaultName: vault.name,
      type: 'project',
      category: 'project',
      title: project,
      visibility: vault.visibility || config.defaults?.visibility,
    });
    const tpl = join(ENGINE_ROOT, 'templates', 'notes', 'project.md');
    let body = `# ${project}\n`;
    if (existsSync(tpl)) {
      const parsed = parse(await readFile(tpl, 'utf8'));
      if (parsed.body?.trim()) body = parsed.body;
    }
    body = body.replaceAll('{{title}}', project).replaceAll('{{DATE}}', today());
    await mkdir(home, { recursive: true });
    await writeFile(projectFile, stringify(fm, body));
    created = true;
  }

  await mkdir(behaviors, { recursive: true });
  return { created, projectFile, behaviors };
}
