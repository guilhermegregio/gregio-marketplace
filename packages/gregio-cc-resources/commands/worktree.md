---
description: Create git worktree to implement a feature
---

## Your task

ultrathink, com base nos requisitos abaixo:

<requirements>
$ARGUMENTS
</requirements>

- faça um brainstorm comigo para coletar mais detalhes sobre o que precisa ser implementado
- crie um nome para nova branch para implementar a feature
- criar arquivo ./tree/<branch>/specs/current.md.

## Create worktree

- create git worktree: `git worktree add -b <branch> ./tree/<branch>`
- copy .env.local to new path: `cp .env.local ./tree/<branch>/`
- copy .envrc to new path: `cp .envrc ./tree/<branch>/`
- enter in new path: `cd ./tree/<branch>`
- enable direnv: `direnv allow`
- install dependencies: `pnpm install`
- create instructions to implement this feature in ./tree/<branch>/specs/current.md override content if exists
- do not implement this feature, only refine plan
