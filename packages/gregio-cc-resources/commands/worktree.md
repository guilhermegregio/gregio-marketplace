---
description: Create git worktree to implement a feature
---

## Your task

ultrathink, com base nos requisitos abaixo:

<requirements>
$ARGUMENTS
</requirements>

Determine if the user wants to:
1. **Create** a new worktree (default) - keywords: "criar", "nova", "implementar", "feature", "add"
2. **Remove** a worktree - keywords: "remover", "deletar", "apagar", "limpar", "remove", "delete", "cleanup"

## Create worktree

If creating a new worktree:

- crie um nome para nova branch para implementar a feature
- create git worktree: `git worktree add -b <branch> ./tree/<branch>`
- copy .env.local to new path: `cp .env.local ./tree/<branch>/`
- copy .envrc to new path: `cp .envrc ./tree/<branch>/`
- enter in new path: `cd ./tree/<branch>`
- enable direnv: `direnv allow`
- install dependencies: `pnpm install`
- do not implement this feature, wait to refine plan with slash command /plan-task

## Remove worktree

If removing a worktree:

- first, list existing worktrees: `git worktree list`
- ask the user which worktree to remove if not specified
- ensure you are NOT inside the worktree directory (go to main repo root)
- remove the worktree: `git worktree remove ./tree/<branch>`
- optionally delete the branch if user confirms: `git branch -d <branch>`
- clean orphaned references: `git worktree prune`
- confirm removal was successful with: `git worktree list`
