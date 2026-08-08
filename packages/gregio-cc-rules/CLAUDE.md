# gregio-cc-rules — manutenção

Package de **rules por contexto**: markdown curto que o agente carrega conforme o que
está tocando (Next server, Astro, n8n, SQL). Distribuição por cópia, via `kb rules
<repo>` (`cli/kb/src/kb/commands/rules.js`). Este package é o DONO do conteúdo; o
engine é só o instalador. `scripts/install-rules.mjs` virou stub de deprecação.

## Contratos que não podem regredir

- **Rule só entra com cicatriz.** Cada item deve rastrear a um bug/retrabalho real. Sem
  isso o arquivo vira lista de boas intenções e ninguém lê.
- **Frontmatter mínimo**: `rule`, `stacks` (array; `all` = universal), `version`. O
  comando parseia por regex — nada de YAML complexo.
- **Idempotência**: reinstalar não pode gerar diff espúrio. O cabeçalho injetado é
  determinístico (nome + versão + origem).
- **`--prune` só remove o que este package escreveu** (detecta pelo marcador
  `gregio-cc-rules` no cabeçalho). Rule própria do repo nunca é apagada.
- **Auto-detecção por evidência**, não por config: `package.json` (incl. `apps/*` e
  `packages/*` de monorepo), `supabase/migrations/`, `apps/n8n-workflows|workflows/`.
  Repo que adota um stack novo ganha a rule na próxima execução.

## Por que o conteúdo fica aqui e o instalador no kb

As rules são **distribuição** (markdown versionado, com cicatriz, revisado por
humano) — vivem no marketplace. Instalar é **runtime do harness** — vive no engine
`kb`, junto de `doctor`/`status`/`map`/`guard`, para que exista um binário só na
mão do usuário. Fronteira: se mudar o conteúdo de uma rule, é aqui; se mudar como a
cópia acontece, é `cli/kb/src/kb/commands/rules.js`.
