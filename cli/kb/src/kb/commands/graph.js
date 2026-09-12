import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, dirname, isAbsolute } from 'node:path';
import { loadConfig, resolvePythonInterp, graphSources, groupRepos } from '../config.js';
import { STATE_DIR, CENTRAL_GRAPH_DEFAULT } from '../paths.js';
import { updateGraph, mergeGraphs, serve, buildMonorepoRoot } from '../graphify.js';
import { enrichVaultGraph } from '../vault-graph.js';

function centralPath(config) {
  const v = config.central?.graphOut;
  if (!v || v === 'auto') return CENTRAL_GRAPH_DEFAULT;
  return isAbsolute(v) ? v : join(STATE_DIR, v);
}

function sourceGraphPath(src) {
  return isAbsolute(src.graphOut) ? src.graphOut : join(src.root, src.graphOut);
}

export async function run({ positionals, opts }) {
  const sub = positionals[0] || 'build';
  switch (sub) {
    case 'build':
      return build(opts);
    case 'merge':
      return mergeOnly(opts);
    case 'serve':
      return serveCmd();
    default:
      console.error('uso: kb graph <build|merge|serve>');
      process.exit(1);
  }
}

function scopedSources(config, opts) {
  if (opts.group) {
    const repos = groupRepos(config, opts.group);
    return graphSources(config, { onlyRepos: repos });
  }
  return graphSources(config);
}

async function build(opts) {
  const config = await loadConfig();
  const sources = scopedSources(config, opts);
  if (!sources.length) throw new Error('nenhuma fonte para construir (registre vaults/projetos)');

  console.log(`Atualizando ${sources.length} fonte(s)...`);
  for (const src of sources) {
    if (!existsSync(src.root)) {
      console.warn(`  ! ${src.repo}: path ausente (${src.root}) — pulando`);
      continue;
    }
    try {
      process.stdout.write(`  ${src.repo} ...`);
      if (src.kind === 'monorepo') {
        await buildMonorepoRoot(src.root, src.subprojects); // C5: por-subprojeto + merge na raiz
      } else {
        await updateGraph(src.root);
      }
      // Enriquecimento de vault: frontmatter → attrs, [[wikilinks]] → arestas.
      // Só fontes vault; tolerante a falha (o grafo cru ainda serve).
      if (src.kind === 'vault') {
        try {
          const r = await enrichVaultGraph(src.root, sourceGraphPath(src));
          process.stdout.write(
            ` ok (enrich: +${r.addedEdges} wikilink, ${r.enrichedNodes} c/ frontmatter` +
              (r.wikilinksUnresolved ? `, ${r.wikilinksUnresolved} não resolvidos` : '') +
              (r.contractEdges ? `, +${r.contractEdges} contratos` : '') +
              ')\n',
          );
        } catch (e) {
          process.stdout.write(` ok (enrich falhou: ${e.message})\n`);
        }
      } else {
        process.stdout.write(' ok\n');
      }
    } catch (e) {
      process.stdout.write(` falhou (${e.message})\n`);
    }
  }
  await doMerge(config, sources, opts);
}

async function mergeOnly(opts) {
  const config = await loadConfig();
  const sources = scopedSources(config, opts);
  await doMerge(config, sources, opts);
}

async function doMerge(config, sources, opts) {
  const inputs = sources.map(sourceGraphPath).filter(p => existsSync(p));
  if (inputs.length < 2) {
    throw new Error(
      `só ${inputs.length} grafo(s) disponível(is) — merge precisa de ≥2. ` +
        'Rode "kb graph build" (ou /graphify em cada repo) primeiro.',
    );
  }
  const out = centralPath(config);
  await mkdir(dirname(out), { recursive: true });
  console.log(`Mesclando ${inputs.length} grafos → ${out}`);
  await mergeGraphs(inputs, out);
  const scope = opts.group ? ` (grupo "${opts.group}")` : '';
  console.log(`Grafo central pronto${scope}. Sirva com "kb graph serve".`);
}

async function serveCmd() {
  const config = await loadConfig();
  const out = centralPath(config);
  if (!existsSync(out)) throw new Error(`grafo central ausente: ${out}. Rode "kb graph build".`);
  const interp = resolvePythonInterp(config);
  // MCP é stdio: o stdout pertence ao protocolo. Tudo que é informativo vai para stderr,
  // e o comando registrado no cliente é `kb graph serve` (estável; o interpretador do
  // graphify vem do nix store e muda a cada rebuild — nunca vai hardcoded na config).
  console.error('Config MCP (stdio) — registre no cliente com o comando estável:');
  console.error('  claude mcp add --scope user kb-central -- kb graph serve');
  console.error(JSON.stringify({ mcpServers: { 'kb-central': { command: 'kb', args: ['graph', 'serve'] } } }, null, 2));
  console.error(`Servindo ${out} via ${interp} — Ctrl+C para parar.`);
  serve(out, interp);
}
