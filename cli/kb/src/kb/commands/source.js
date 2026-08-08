// Costura para fontes externas (Discord, Gmail). Fase posterior.
// Contrato previsto: normalize(raw) -> { subfolder, frontmatter, body }
// e então o mesmo write-path do `kb add` (enrich + write + update na raiz do vault).

export async function run({ positionals }) {
  const provider = positionals[0];
  console.error(
    `kb source ${provider ?? ''}: ainda não implementado (fase posterior).\n` +
      'Discord reusa src/index.js + src/consolidate.js; Gmail usa o MCP do Gmail.\n' +
      'Veja a doc do engine no vault (vault-pessoal/10-projects/ai-dev-harness/kb-engine.md).',
  );
  process.exit(1);
}
