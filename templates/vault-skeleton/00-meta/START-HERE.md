---
id: meta-start-here
type: doc
title: Comece aqui — onde adiciono o quê
status: active
visibility: {{VISIBILITY}}
created: {{DATE}}
updated: {{DATE}}
---

# Comece aqui

Regra de ouro: **`kb` para criar** (garante pasta + frontmatter), **Obsidian para
editar** (humano ou agente). O inbox é a porta de captura; processar = mover para o
lugar certo.

## Árvore de decisão

| Quero… | Faço | Vai para |
|---|---|---|
| jogar um pensamento/link rápido | `kb capture "..." --vault {{VAULT_NAME}}` | `60-sources/_inbox.md` |
| guardar URL (artigo/ideia/pesquisa) | `kb add <url> --vault {{VAULT_NAME}} --as <cat>` | `60-sources/...` ou `50-research/<topic>` |
| criar nota estruturada | `kb new --type project\|plan\|adr\|learning\|pattern --title "..."` | pasta certa por tipo |
| editar algo que já existe | direto no Obsidian (humano **ou** agente) | mantém o frontmatter |
| destilar aprendizado durável | `kb new --type learning\|pattern` | `40-knowledge/` |

Categorias do `--as`: `article→60-sources/articles`, `idea→60-sources/ideas`,
`research→50-research/<topic>`, `learning→40-knowledge/learnings`,
`pattern→40-knowledge/patterns`, `content→90-content/<slug>`.

## Ler sem estourar contexto

Router ([[_index]]) → índices das pastas → folhas-alvo. Pergunta cross-projeto → grafo
(MCP), não `ls -R`. Contrato em [[conventions]]; o que vai onde em [[taxonomy]].
Setup do app em [[obsidian-setup]].
