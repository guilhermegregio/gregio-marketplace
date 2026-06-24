import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, getVault, defaultVault } from '../config.js';
import { expandPath, ENGINE_ROOT } from '../paths.js';
import { asList } from '../args.js';
import { resolveNewTarget } from '../routing.js';
import { buildFrontmatter, uniquePath, today } from '../note.js';
import { stringify, parse } from '../frontmatter.js';

export async function run({ opts }) {
  const config = await loadConfig();
  const vault = opts.vault ? getVault(config, opts.vault) : defaultVault(config);
  const root = expandPath(vault.path);

  const title = opts.title;
  if (!title) throw new Error('uso: kb new --vault <n> --type <t> --title "..." [--topic t] [--project p]');

  const kind = opts.type || opts.as || 'article';
  const projects = asList(opts.projects);
  const { folder, type, base } = resolveNewTarget(kind, {
    topic: opts.topic,
    title,
    project: opts.project || projects[0],
  });

  const fm = buildFrontmatter({
    vaultName: vault.name,
    type,
    category: kind,
    title,
    status: opts.status,
    projects,
    groups: asList(opts.groups),
    stack: asList(opts.stack),
    tags: asList(opts.tags),
    visibility: opts.visibility || vault.visibility || config.defaults?.visibility,
  });

  // Corpo a partir do template do tipo (no engine), se existir; substitui {{title}}/{{DATE}}.
  const tplPath = join(ENGINE_ROOT, 'templates', 'notes', `${type}.md`);
  let body = `# ${title}\n`;
  if (existsSync(tplPath)) {
    const parsed = parse(await readFile(tplPath, 'utf8'));
    if (parsed.body?.trim()) body = parsed.body;
  }
  body = body.replaceAll('{{title}}', title).replaceAll('{{DATE}}', today());

  const dir = join(root, folder);
  await mkdir(dir, { recursive: true });
  // _project/_plan são nomes fixos; demais evitam colisão.
  const outPath = base.startsWith('_') ? join(dir, `${base}.md`) : uniquePath(dir, base);
  await writeFile(outPath, stringify(fm, body));
  console.log(`Nota criada: ${outPath}`);
  console.log('Lembre de commitar no repo do vault.');
}
