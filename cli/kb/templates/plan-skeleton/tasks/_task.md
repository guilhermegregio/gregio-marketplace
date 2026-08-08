---
id: T01
plan: {{SLUG}}
title: ""
status: todo                    # todo|assigned|running|review|blocked|done
owner: null
depends_on: []
scope:                         # escopo de escrita = chave de exclusão mútua do paralelismo
  -
repo: {{PROJECT}}
branch: T01-slug
gates: []                      # comandos one-shot (rodáveis por `kb dev check --task`)
---

## Contexto (mínimo)

(2–5 frases; o agente age SEM abrir o _plan.md. Contratos de interface, não "leia Txx".)

## Passos

1.

## Comandos / gates

-

## Done-criteria

- [ ] ...
- [ ] `node --check` / gates verdes. Diff ⊆ `scope`.

## Iterar/revisar

(como se auto-corrigir; auto-review: `git diff --name-only ⊆ scope`)
