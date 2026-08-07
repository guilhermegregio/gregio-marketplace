---
id: TP
plan: {{SLUG}}
title: "Protótipo — <telas> no ds-agent"
status: todo
stage: prototype
gate: human
owner: null
depends_on: []
scope:
  - /home/gregio/code/ds-agent/apps/ds-nxt/src
repo: ds-agent
branch: TP-{{SLUG}}-proto
gates: ["pnpm exec nx build ds-nxt"]
---

## Contexto (mínimo)

Protótipo navegável ANTES de implementar: layout ruim descoberto no app custa 10x.
Reusar os padrões existentes do protótipo (AppShell, cards, OptionCard) — o handoff é
tradução direta, então caminho de rota e nomes de campo espelham produção.

## Passos

1. Telas do fluxo, com dados mock no shape real.
2. Iterar com o usuário por screenshot até aprovar.

## Done-criteria

- [ ] Navegável; build verde.
- [ ] ⛔ **GATE**: usuário aprovou o layout. Sem isso, não seguir para behaviors.
