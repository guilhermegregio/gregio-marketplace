import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig, getVault, defaultVault, resolvePythonInterp } from '../config.js';
import { expandPath } from '../paths.js';
import { asList } from '../args.js';
import { resolveSubfolder, inferCategoryFromMedia, guessMediaType } from '../routing.js';
import { buildFrontmatter } from '../note.js';
import { merge } from '../frontmatter.js';
import { ingestUrl, updateGraph } from '../graphify.js';

export async function run({ positionals, opts }) {
  const url = positionals[0];
  if (!url) throw new Error('uso: kb add <url> --vault <n> [--as <cat>] [--topic t]');

  const config = await loadConfig();
  const vault = opts.vault ? getVault(config, opts.vault) : defaultVault(config);
  const root = expandPath(vault.path);
  const interp = resolvePythonInterp(config);

  // 1. Resolve categoria: --as explícito, senão inferência por mídia, senão default.
  const media = guessMediaType(url);
  let category = opts.as;
  if (!category) {
    category = inferCategoryFromMedia(media) || config.defaults?.category || 'article';
    // Refino opcional article|idea|research via claude --print.
    if (opts.smart === true) {
      const refined = smartCategory(url);
      if (refined) category = refined;
    }
  }

  const { folder, type } = resolveSubfolder(category, { topic: opts.topic, title: url });
  const destDir = join(root, folder);
  await mkdir(destDir, { recursive: true });

  // 2. Ingest com destino sobrescrito (NUNCA cai em ./raw).
  console.log(`Ingerindo ${url} → ${vault.name}/${folder} ...`);
  const savedPath = await ingestUrl(url, destDir, interp, {
    author: opts.author,
    contributor: opts.contributor,
  });

  // 3. Enriquece o frontmatter conforme o contrato.
  const existing = await readFile(savedPath, 'utf8');
  const fm = buildFrontmatter({
    vaultName: vault.name,
    type,
    category,
    title: titleFromIngest(existing) || url,
    status: opts.status,
    projects: asList(opts.projects),
    groups: asList(opts.groups),
    stack: asList(opts.stack),
    tags: [...asList(opts.tags), `source/${media}`],
    visibility: opts.visibility || vault.visibility || config.defaults?.visibility,
    sourceUrl: url,
  });
  await writeFile(savedPath, merge(existing, fm));
  console.log(`Nota: ${savedPath}`);

  // 4. Update do grafo na RAIZ do vault (gotcha de scan-root), salvo --no-update.
  if (opts['no-update'] === true) {
    console.log('(--no-update) Rode "kb graph build" depois para atualizar o grafo.');
  } else {
    console.log('Atualizando grafo do vault...');
    await updateGraph(root);
  }
  console.log('Lembre de commitar no repo do vault.');
}

function titleFromIngest(text) {
  const m = text.match(/^title:\s*"?(.+?)"?\s*$/m);
  return m ? m[1] : null;
}

// Pergunta ao claude CLI a categoria semântica. Best-effort; null se falhar.
function smartCategory(url) {
  const prompt =
    `Classifique o conteúdo desta URL em UMA palavra: article, idea ou research. ` +
    `Responda só a palavra. URL: ${url}`;
  const res = spawnSync('claude', ['--print'], { input: prompt, encoding: 'utf8' });
  if (res.status !== 0 || !res.stdout) return null;
  const word = res.stdout.trim().toLowerCase().match(/article|idea|research/);
  return word ? word[0] : null;
}
