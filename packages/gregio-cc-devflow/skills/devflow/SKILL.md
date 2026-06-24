---
name: devflow
description: "Conduz um ciclo de desenvolvimento ponta-a-ponta num repo de código, mantendo o grafo local (graphify-out/) e a base de conhecimento (vault + grafo central) em dia. Use SEMPRE que o usuário disser 'vamos desenvolver/implementar/construir X', 'começa a feature/fix Y', 'planeja e implementa Z neste repo', 'monta o plano disso', 'agora finaliza e promove', 'sincroniza o grafo do projeto', ou descrever uma tarefa de código que precisa de plano + execução + validação. Cinco estágios via o CLI 'kb dev' (start/check/run/done): DRAFT → SINCRONIZAR → PLANEJAR → EXECUTAR → VALIDAR → PROMOVER. NÃO use para perguntas puras de consulta (use a skill kb) nem para tarefas sem código."
argument-hint: [start <slug> | check <slug> | run <slug> | done <slug>]
---

## O que é

O ciclo de engenharia que **consome** a skill `kb` (conhecimento) nas pontas. Regra de
fronteira: **repo = código + runtime** (`CLAUDE.md`, `references/` de skills,
`graphify-out/` só-código, `behavior.feature` por módulo); **vault = conhecimento**
(arquitetura, PRD, spec, lições, ADR, logs). Toda escrita de conhecimento passa por
comandos `kb`/`kb dev` — nunca crie `.md` de design solto no repo.

Comandos (CLI no repo `knowledge-gregio`, `node bin/kb.js dev <sub>`):

```bash
kb dev start <slug> --vault <n> --project <repo> [--title t]   # cria 30-plans/<slug>/ (draft)
kb dev check <slug> [--task Txx]                               # valida DAG/ready-set; roda gates de uma task
kb dev run <slug> [--max N] [--dry-run]                        # orquestra as ondas (deps + escopo disjunto)
kb dev done <slug> [--promote learning,adr,c4]                 # promove durável + arquiva + re-merge central
```

## Estágios (repo vs vault)

| Estágio | Ação | Repo | Vault |
|---|---|---|---|
| **DRAFT** | `kb capture` / `kb dev start` (semente) | — | `_plan.md` (draft) |
| **SINCRONIZAR** | `kb graph build --group <g>` + grafo local do repo | `graphify-out/` (só código) | — |
| **PLANEJAR** | consultar grafo (MCP), escrever `_plan.md` + `tasks/*` com **gates** e `scope` | (lê) | plano + tasks |
| **EXECUTAR** | worktree isolado (`wtree --herdr`); agente implementa; loga | código + runtime | `execution/<data>.md` |
| **VALIDAR** | `kb dev check --task` roda os gates; loop até verde | (roda testes) | checkboxes / status review |
| **PROMOVER** | `kb dev done`: durável → vault, **arquiva** plano, re-merge central | merge + `graphify-out/` | lições/ADR/spec + `_archive/` |

## Gate de handoff (montar ≠ executar)

Quem **monta** o plano (`kb dev start` + edita tasks) **para** e marca o `_plan.md`
`status: ready-for-review`. O humano revisa cortes/escopos/DAG e troca para `approved`.
Só então `kb dev run` (ou execução manual task a task). Detalhe em
`vault-pessoal/10-projects/ai-dev-harness/plan-structure.md`.

## Tasks atômicas + paralelismo

Cada task em `tasks/Txx-*.md` é **atômica**: um agente faz execute→validate→iterate→
review→finalize com **só o arquivo da task** (contexto embutido; contratos de interface,
nunca "leia Txx"; estrutura global via grafo/MCP). `scope` (escopo de escrita) é a chave
de exclusão mútua: `kb dev run` despacha em **ondas** tasks com deps satisfeitas e escopo
**disjunto**, cada uma num `wtree --herdr` (worktree + workspace). Processos longos
(dev server, test-watch) em **panes separados**, nunca background. Merge de volta é
**serial e local** (botão de merge do GitHub ignora merge-driver).

## Honestidade

- Conhecimento durável só via `kb`/`kb dev` (não escreva doc de design no repo).
- Não confie só no status inferido do agente — use o sentinela explícito de done/blocked.
- Verifique `git diff --name-only ⊆ scope` antes do merge (anti scope-leak).
