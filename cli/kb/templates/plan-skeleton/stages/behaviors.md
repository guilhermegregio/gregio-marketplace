---
id: TB
plan: {{SLUG}}
title: "Contrato — <escopo>.feature (Gherkin) na casa do projeto no vault"
status: todo
stage: behaviors
gate: human
owner: null
depends_on: [TP]
scope:
  - {{VAULT_DIR}}/10-projects/{{PROJECT}}/behaviors/<escopo>.feature
repo: {{VAULT_NAME}}
branch: TB-{{SLUG}}-contrato
gates: []
---

## Contexto (mínimo)

O contrato do que o software vai fazer, escrito ANTES do código, a partir da spec e do
protótipo aprovado. Cenários em português, no nível do comportamento observável —
nada de detalhe de implementação.

O contrato mora na **casa do projeto no vault** (`{{VAULT_DIR}}/10-projects/{{PROJECT}}/behaviors/`),
não no repo: é conhecimento, tem um path único (não se duplica por worktree) e herda a
visibilidade do vault. Um arquivo por escopo — em monorepo, um por app/módulo.

Cobrir: o caminho feliz, as regressões que não podem acontecer, e os casos de borda
que a spec fixou.

## Passos

1. Escrever/estender `{{VAULT_DIR}}/10-projects/{{PROJECT}}/behaviors/<escopo>.feature` (um por app/módulo afetado).
2. Declarar os arquivos em `contracts:` no `_plan.md`, relativos a `10-projects/`:
   `contracts: [{{PROJECT}}/behaviors/<escopo>.feature]`
3. ⛔ **GATE**: usuário lê e aprova os cenários.
4. `kb dev freeze {{SLUG}}` → 🧊 a partir daqui o contrato manda.

## Done-criteria

- [ ] Cenários aprovados pelo usuário.
- [ ] `kb dev frozen --slug {{SLUG}}` lista os contratos congelados.
