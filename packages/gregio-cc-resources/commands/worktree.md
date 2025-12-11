---
description: Create git worktree to implement a feature
---

## Your task

ultrathink, com base nos requisitos abaixo:

<requirements>
$ARGUMENTS
</requirements>

- crie um nome para nova branch para implementar a feature

## Create worktree

- create git worktree: `git worktree add -b <branch> ./tree/<branch>`
- copy .env.local to new path: `cp .env.local ./tree/<branch>/`
- copy .envrc to new path: `cp .envrc ./tree/<branch>/`
- enter in new path: `cd ./tree/<branch>`
- enable direnv: `direnv allow`
- install dependencies: `pnpm install`
- do not implement this feature, wait to refine plan with slash command /plan-task
