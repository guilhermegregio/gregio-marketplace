---
id: TB
plan: {{SLUG}}
title: "Contrato — behaviors.feature (Gherkin)"
status: todo
stage: behaviors
gate: human
owner: null
depends_on: [TP]
scope:
  - <repo>/behaviors.feature
repo: {{PROJECT}}
branch: TB-{{SLUG}}-contrato
gates: []
---

## Contexto (mínimo)

O contrato do que o software vai fazer, escrito ANTES do código, a partir da spec e do
protótipo aprovado. Cenários em português, no nível do comportamento observável —
nada de detalhe de implementação.

Cobrir: o caminho feliz, as regressões que não podem acontecer, e os casos de borda
que a spec fixou.

## Passos

1. Escrever/estender a seção no `behaviors.feature` do(s) app(s) afetado(s).
2. Declarar os arquivos em `contracts:` no `_plan.md`.
3. ⛔ **GATE**: usuário lê e aprova os cenários.
4. `kb dev freeze {{SLUG}}` → 🧊 a partir daqui o contrato manda.

## Done-criteria

- [ ] Cenários aprovados pelo usuário.
- [ ] `kb dev frozen --slug {{SLUG}}` lista os contratos congelados.
