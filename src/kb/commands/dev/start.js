import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, getVault, defaultVault } from '../../config.js';
import { expandPath, ENGINE_ROOT } from '../../paths.js';
import { renderTokens } from '../../templates.js';
import { today } from '../../note.js';

// kb dev start <slug> --vault <n> --project <repo> [--title t]
// Scaffolda 30-plans/<slug>/{_plan.md, tasks/, execution/} a partir do plan-skeleton.
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

  console.log(`Plano criado: ${dir} (status: draft)`);
  console.log('Edite _plan.md + tasks/, troque para status: ready-for-review e pare para revisão (gate de handoff).');
}
