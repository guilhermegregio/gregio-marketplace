---
id: TB
plan: {{SLUG}}
title: "Contrato — <escopo>.feature.md (Gherkin em markdown) na casa do projeto no vault"
status: todo
stage: behaviors
gate: human
owner: null
depends_on: [TP]
scope:
  - {{VAULT_DIR}}/10-projects/{{PROJECT}}/behaviors/<escopo>.feature.md
repo: {{VAULT_NAME}}
branch: TB-{{SLUG}}-contrato
gates: []
---

## Contexto (mínimo)

O contrato do que o software vai fazer, escrito ANTES do código, a partir da spec e do
protótipo aprovado. Markdown com blocos gherkin — lido por humano e agente e indexado
pelo grafo, não executado por cucumber. Cenários em português, no nível do comportamento observável —
nada de detalhe de implementação.

O contrato mora na **casa do projeto no vault** (`{{VAULT_DIR}}/10-projects/{{PROJECT}}/behaviors/`),
não no repo: é conhecimento, tem um path único (não se duplica por worktree) e herda a
visibilidade do vault. Um arquivo por escopo — em monorepo, um por app/módulo.

Cobrir: o caminho feliz, as regressões que não podem acontecer, e os casos de borda
que a spec fixou.

## Passos

1. Criar o contrato com `kb new --type contract --vault {{VAULT_NAME}} --project {{PROJECT}} --title "<escopo>" --plan {{SLUG}}`
   → `{{VAULT_DIR}}/10-projects/{{PROJECT}}/behaviors/<escopo>.feature.md` (um por app/módulo
   afetado; para estender um existente, edite-o). Formato: frontmatter `type: contract`,
   `# Contrato — <título>`, uma seção `## Funcionalidade: <nome>` por funcionalidade e os
   cenários num bloco ` ```gherkin ` (`# language: pt`).
2. Declarar os arquivos em `contracts:` no `_plan.md`, relativos a `10-projects/`:
   `contracts: [{{PROJECT}}/behaviors/<escopo>.feature.md]`
3. ⛔ **GATE**: usuário lê e aprova os cenários.
4. `kb dev freeze {{SLUG}}` → 🧊 a partir daqui o contrato manda.

## Done-criteria

- [ ] Cenários aprovados pelo usuário.
- [ ] `kb dev frozen --slug {{SLUG}}` lista os contratos congelados.
