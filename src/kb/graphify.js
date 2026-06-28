import { spawn } from 'node:child_process';
import { mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

// ÚNICO ponto que invoca o graphify. Mantém o gotcha de scan-root contido:
// update/build SEMPRE recebem a raiz inteira do repo/vault, nunca uma subpasta.

function run(cmd, args, { cwd, inherit = true } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd,
      stdio: inherit ? ['ignore', 'pipe', 'inherit'] : ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', c => (stdout += c.toString()));
    proc.stderr?.on('data', c => (stderr += c.toString()));
    proc.on('error', err =>
      reject(new Error(`falha ao executar ${cmd}: ${err.message} (está no PATH?)`)),
    );
    proc.on('close', code => resolve({ code, stdout, stderr }));
  });
}

// Baixa uma URL para destDir via graphify.ingest, devolve o caminho salvo.
export async function ingestUrl(url, destDir, interp, { author, contributor } = {}) {
  const snippet = `
import sys
from pathlib import Path
from graphify.ingest import ingest
kwargs = {}
if len(sys.argv) > 3 and sys.argv[3]:
    kwargs['author'] = sys.argv[3]
if len(sys.argv) > 4 and sys.argv[4]:
    kwargs['contributor'] = sys.argv[4]
out = ingest(sys.argv[1], Path(sys.argv[2]), **kwargs)
print(out)
`;
  const { code, stdout } = await run(
    interp,
    ['-c', snippet, url, destDir, author ?? '', contributor ?? ''],
    { inherit: false },
  );
  if (code !== 0) throw new Error(`graphify ingest falhou (código ${code})`);
  return stdout.trim().split('\n').pop().trim();
}

// Re-extrai/atualiza o grafo de um repo. SEMPRE com a raiz inteira.
export async function updateGraph(root) {
  const { code } = await run('graphify', ['update', root]);
  if (code !== 0) throw new Error(`graphify update falhou em ${root} (código ${code})`);
}

// Build de monorepo (decisão C5): extrai o grafo de cada subprojeto (scan-root = a
// subpath, autocontido) e mescla todos num MERGE NA RAIZ em <repoRoot>/graphify-out/
// graph.json. Esse merge-raiz é a fonte que o grafo central indexa (1 fonte por
// monorepo, não N subgrafos). Os subgrafos por-subprojeto seguem em disco p/
// planejamento local dentro do subprojeto. Retorna o path do merge-raiz.
// Nota: ao alimentar o central, o merge-graphs re-namespaceia o repo p/ o basename
// da raiz do monorepo (= nome do projeto quando name==basename, o caso comum).
export async function buildMonorepoRoot(repoRoot, subprojects) {
  if (!Array.isArray(subprojects) || !subprojects.length) {
    throw new Error(`monorepo ${repoRoot} sem subprojects p/ build`);
  }
  const subGraphs = [];
  for (const sp of subprojects) {
    const subRoot = join(repoRoot, sp.subpath);
    await updateGraph(subRoot); // scan-root = a subpath (cada subgrafo autocontido)
    subGraphs.push(join(subRoot, sp.graphOut ?? 'graphify-out/graph.json'));
  }
  const rootDir = join(repoRoot, 'graphify-out');
  const rootOut = join(rootDir, 'graph.json');
  await mkdir(rootDir, { recursive: true });
  if (subGraphs.length === 1) {
    await copyFile(subGraphs[0], rootOut); // merge-graphs exige ≥2; 1 subprojeto = cópia
  } else {
    await mergeGraphs(subGraphs, rootOut);
  }
  return rootOut;
}

// Merge de N grafos num grafo central.
export async function mergeGraphs(inputs, outPath) {
  if (inputs.length < 2) {
    throw new Error('merge-graphs precisa de pelo menos 2 grafos de entrada');
  }
  const { code } = await run('graphify', ['merge-graphs', ...inputs, '--out', outPath]);
  if (code !== 0) throw new Error(`graphify merge-graphs falhou (código ${code})`);
}

// Sobe o servidor MCP (stdio) servindo um graph.json. Não retorna (fica em foreground).
export function serve(graphPath, interp) {
  const proc = spawn(interp, ['-m', 'graphify.serve', graphPath], { stdio: 'inherit' });
  proc.on('error', err => {
    console.error(`falha ao subir MCP: ${err.message}`);
    process.exit(1);
  });
  return proc;
}
