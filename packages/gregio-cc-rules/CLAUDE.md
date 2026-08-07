# gregio-cc-rules — manutenção

Package de **rules por contexto**: markdown curto que o agente carrega conforme o que
está tocando (Next server, Astro, n8n, SQL). Distribuição por cópia, via
`scripts/install-rules.mjs`.

## Contratos que não podem regredir

- **Rule só entra com cicatriz.** Cada item deve rastrear a um bug/retrabalho real. Sem
  isso o arquivo vira lista de boas intenções e ninguém lê.
- **Frontmatter mínimo**: `rule`, `stacks` (array; `all` = universal), `version`. O
  script parseia por regex — nada de YAML complexo.
- **Idempotência**: reinstalar não pode gerar diff espúrio. O cabeçalho injetado é
  determinístico (nome + versão + origem).
- **`--prune` só remove o que este package escreveu** (detecta pelo marcador
  `gregio-cc-rules` no cabeçalho). Rule própria do repo nunca é apagada.
- **Auto-detecção por evidência**, não por config: `package.json` (incl. `apps/*` e
  `packages/*` de monorepo), `supabase/migrations/`, `apps/n8n-workflows|workflows/`.
  Repo que adota um stack novo ganha a rule na próxima execução.

## Por que aqui e não no knowledge-gregio

Marketplace = **distribuição** do harness (skills, plugins, hooks, rules).
knowledge-gregio = **engine** do kb (ingestão, grafo, planos). Não misturar: a ponte de
instalação mora aqui; o kb, se quiser, apenas invoca.

## Evolução prevista

Este script é o MVP do `harness bootstrap` (plano `harness-vnext`, T06): instalar
plugins, materializar rules, conferir config do kb, gerar CLAUDE.md, mapear repos de
`~/code` e um `doctor` do conjunto.
