---
id: TP
plan: {{SLUG}}
title: "Protótipo — <telas>"
status: todo
stage: prototype
gate: human
owner: null
depends_on: []
scope:                          # onde o protótipo é escrito (relativo ao repo)
  - src
repo: {{PROJECT}}               # troque se o protótipo mora noutro repo que não o do plano
branch: TP-{{SLUG}}-proto
gates: []                       # o build do protótipo, ex.: ["pnpm build"]
---

## Contexto (mínimo)

Protótipo navegável ANTES de implementar: layout ruim descoberto no app custa 10x.
Reusar os padrões que o protótipo já tem (shell da aplicação, cards, campos) — o handoff
é tradução direta, então caminho de rota e nomes de campo espelham produção.

## Passos

1. Telas do fluxo, com dados mock no shape real.
2. Iterar com o usuário por screenshot até aprovar.

## Done-criteria

- [ ] Navegável; build verde.
- [ ] ⛔ **GATE**: usuário aprovou o layout. Sem isso, não seguir para behaviors.
