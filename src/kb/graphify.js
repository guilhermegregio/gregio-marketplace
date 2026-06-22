import { spawn } from 'node:child_process';

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
