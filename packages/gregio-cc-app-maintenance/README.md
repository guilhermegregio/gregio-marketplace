# gregio-cc-app-maintenance

Skills para manutenção recorrente de apps Node.js — agnósticas ao formato do repo.

Cada skill detecta automaticamente o tipo de projeto (Nx monorepo, pnpm workspace, ou app pnpm simples) e adapta os comandos que executa. O objetivo é um ciclo de manutenção seguro: detecta → aplica → valida (lint + typecheck + test + build) → se falhar, corrige e tenta de novo → se passar, commita.

## Skills

| Skill | Descrição |
|-------|-----------|
| `update-deps` | Atualiza dependências com `npm-check-updates`, valida em 4 frentes (lint, typecheck, test, build) até 3 tentativas com auto-fix, e opcionalmente faz uma checagem visual com Chrome DevTools MCP. |

## Scripts compartilhados

- `scripts/detect-repo-type.js <dir>` — imprime JSON com `{ type, root, hasOverrides, hasPatches, hasDevServer, ... }`. Usado por todas as skills deste package para se adaptar ao repo.
- `scripts/has-dev-server.js <dir>` — retorna `true`/`false` indicando se há um script `dev`/`start` + framework web detectável (próxima iteração: portas preferenciais).

## Convenções

- pnpm em primeiro lugar (alinha com o setup do autor).
- Sem `--no-verify` em commits — hooks existem por um motivo.
- Rollback limpo quando a validação não passa: `git checkout -- .` + `pnpm install`.
- `workspace:*` e versões unificadas do Nx (`nx`, `@nx/*`) são preservados.

## Requisitos

- pnpm ≥ 9
- Node ≥ 20
- Acesso ao MCP `chrome-devtools` (opcional, só para validação visual)
