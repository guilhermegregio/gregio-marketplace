---
id: {{VAULT_NAME}}-plan-{{SLUG}}
type: plan
title: "{{TITLE}}"
plan: {{SLUG}}
status: draft                   # draft → ready-for-review → approved → in-progress → done
prepared_by: null
prepared_at: {{DATE}}
approved_by: null
approved_at: null
projects: [{{PROJECT}}]
groups: []
stack: []
tags: [{{SLUG}}, plano]
visibility: {{VISIBILITY}}
gates_globais: []
contracts: []                   # contratos .feature.md congelados por `kb dev freeze`, relativos a <vault>/10-projects/ — ex.: {{PROJECT}}/behaviors/<escopo>.feature.md (sem extensão tenta .feature.md, depois .feature legado)
created: {{DATE}}
updated: {{DATE}}
---

# {{TITLE}}

> Plano em `draft`. Ao terminar de montar as tasks, troque para `ready-for-review` e
> pare (gate de handoff). Veja [[plan-structure]].
>
> **Fluxo (devflow v2):** spec → protótipo ⛔ → behaviors ⛔🧊 → código → review →
> finish. Os ⛔ são gates humanos; o 🧊 é o freeze do contrato: depois dele, cenário
> quebrando significa código errado. Mudar comportamento exige
> `kb dev unfreeze <slug> --reason "..."`.

## Objetivo

(o que se quer alcançar e por quê)

## Não-objetivos

-

## Escopo / repos

-

## DAG / paralelismo

```mermaid
graph LR
  T01[T01 ...] --> T02[T02 ...]
```

## Tasks

| id | título | repo | dep | escopo (resumo) |
|---|---|---|---|---|
| T01 | ... | {{PROJECT}} | — | ... |

## Gates globais

-

## Como aprovar

Revisar cortes/escopos/DAG. Trocar `status: ready-for-review` → `approved` +
`approved_by`. Depois `kb dev run {{SLUG}}` (ou execução manual task a task).
