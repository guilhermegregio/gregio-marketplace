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
created: {{DATE}}
updated: {{DATE}}
---

# {{TITLE}}

> Plano em `draft`. Ao terminar de montar as tasks, troque para `ready-for-review` e
> pare (gate de handoff). Veja [[plan-structure]].

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
