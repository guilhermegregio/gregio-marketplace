# gregio-cc-rules

Rules por contexto para os repos do harness. Cada rule é um markdown curto com regras
**nascidas de dor real** — o que quebrou, por que, e a forma certa.

## Instalar num repo

O instalador é o engine `kb` (`scripts/install-rules.mjs` virou stub de deprecação):

```bash
kb rules /caminho/do/repo            # auto-detecta stacks
kb rules /caminho/do/repo --dry-run  # mostra o que faria
kb rules /caminho/do/repo --stack next,sql
kb rules --list                      # rules disponíveis
```

O `kb rules` acha este diretório por `KB_RULES_DIR`, pelo path relativo ao engine
(checkout/worktree do marketplace) ou pelo marketplace instalado em
`~/.claude/plugins/repos/`.

Materializa em `<repo>/.claude/rules/*.md`. Idempotente: rodar de novo atualiza, e o
`git diff` do repo mostra o que mudou. `--prune` remove rules deste package que não se
aplicam mais (rules próprias do repo, sem o marcador, ficam).

## Rules

| rule | stacks | assunto |
|---|---|---|
| `common` | todos | escopo explícito, gatilho por estado real, build verde ≠ integração |
| `next-server` | next | server actions escopadas, revalidate, fronteira de package |
| `next-client` | next | `use client`, cor de ação × informação, rota como parâmetro |
| `astro-ds` | astro | protótipos espelham produção, tokens do DS, zero CDN |
| `n8n-workflows` | n8n | IDs do próprio grupo, sem `$env`, jsonb objeto, credencial por ambiente |
| `supabase-sql` | sql | migration idempotente, RPC com caso "todos", RLS por helper |

## Como o repo carrega

O `CLAUDE.md` do repo aponta para `.claude/rules/` — o agente lê a rule do contexto em
que está mexendo, sem carregar tudo. Repos registrados no `kb` recebem esse ponteiro
pelo `kb project link-claude`.

## Adicionar uma rule

Só entra regra com cicatriz: um bug que aconteceu, um retrabalho que doeu. Frontmatter
mínimo (`rule`, `stacks`, `version`); bump de `version` a cada mudança de conteúdo.
