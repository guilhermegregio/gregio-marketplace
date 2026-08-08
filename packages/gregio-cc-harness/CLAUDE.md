# gregio-cc-harness — manutenção

Package **fino**: a implementação mudou de casa. `doctor`, `status`, `map`,
`rules` e `guard` são subcomandos do engine `kb` (`cli/kb/src/kb/commands/`);
aqui ficam só a doc do consumidor (README) e os contratos abaixo.

| aqui era | agora é | código |
|---|---|---|
| `scripts/harness.mjs doctor` | `kb doctor` | `cli/kb/src/kb/commands/doctor.js` |
| `scripts/harness.mjs status` | `kb status` | `cli/kb/src/kb/commands/status.js` + `cli/kb/src/kb/repo-status.js` |
| `scripts/harness.mjs map` | `kb map` | `cli/kb/src/kb/commands/map.js` |
| `scripts/harness.mjs install` | `kb rules <repo>` + hook `kb guard` | `commands/rules.js`, `commands/guard.js` |

`scripts/harness.mjs` é stub de deprecação (aponta o comando `kb` e sai 1) — não
ressuscite lógica aqui.

## Contratos que não podem regredir

- **Check só entra com cicatriz.** Cada check do `kb doctor` rastreia uma dor
  real: plugin instalado mas desabilitado em `enabledPlugins` passou semanas
  despercebido; credencial n8n dev apontando pra prod
  (`auth.nxttrainingapp.com`) queimou dados reais; guard ausente deixa
  freeze/wtree sem guardrail. Não remova um check sem registrar o porquê.
- **`kb doctor` sai com 1 se qualquer ✗** — automação depende do exit code, não
  do texto. Check pulado (docker/n8n ausente) imprime `-` e não conta como falha.
- **O check do hook aceita os dois mundos durante a transição**: `kb guard` (o
  jeito novo) e `guard.mjs` (instalações antigas continuam protegidas) — o
  legado passa com nota de migração, não com ✗. Quem já migrou não pode ver
  falha falsa; quem não migrou não pode achar que está desprotegido.
- **`kb rules` NUNCA duplica o conteúdo das rules.** As rules moram em
  `packages/gregio-cc-rules/rules`; o comando só resolve o diretório (env
  `KB_RULES_DIR` → path relativo ao engine → plugin cache) e copia. Auto-detecção
  de stack, idempotência e `--prune` têm dono único.
- **`kb map` não executa nada** — só sugere `kb project add`.
- **`XDG_CONFIG_HOME`/`KB_CONFIG` são respeitados** para achar o kb config (via
  `cli/kb/src/kb/paths.js`) — NixOS e ambientes de teste dependem disso.

## Armadilhas conhecidas

- `map` considera registrado quem está em `projects` **ou** `vaults` do kb
  config — vaults são repos git em `~/code`, mas registrá-los como project
  seria errado.
- Plugins com scope `project`/`local` não são cobrados em `enabledPlugins`
  global (são habilitados por projeto); o doctor só valida scope `user`.
- A query do n8n roda dentro do container `postgres-dev` com `$POSTGRES_USER`
  expandido pelo `sh -c` **de dentro** do container — não troque por expansão
  local.

## `kb status` — contratos

- **`warn` vs `info`**: `warn` = "você perde trabalho se ignorar" (uncommitted,
  ahead, stash, branch não mergeada); `info` = contexto (worktree ativo, behind).
  O exit 1 só conta `warn` — quem usa isso em CI/hook não pode ser interrompido
  por informação.
- **Nunca apaga nada.** Diretório órfão em `~/code/worktrees` é REPORTADO com o
  `rm -rf` pronto para copiar; executar por conta própria seria apagar trabalho
  que o git já não consegue recuperar.
- **1 nível de profundidade** em `~/code`: monorepo é um repo, não varremos dentro.
- **Branch principal** é `main` ou `master`, o que existir; sem nenhuma das duas,
  o check de branch não mergeada é pulado (não inventa base de comparação).
- **Dono estranho**: a varredura de `foreignOwner` é rasa (4 níveis) e para no
  primeiro achado — o objetivo é decidir QUAL dica mostrar, não inventariar o
  diretório. Falha de leitura conta como dono estranho (não conseguir listar já
  é o sintoma).
- **Sem repos ≠ sem trabalho**: `status` continua checando os órfãos de
  `<base>/worktrees` mesmo quando não há nenhum repo git na base.

## Testes manuais

```bash
node cli/kb/bin/kb.js doctor          # exit 1 é resultado válido se houver ✗ real
node cli/kb/bin/kb.js status --all
node cli/kb/bin/kb.js map
node cli/kb/bin/kb.js rules /tmp/repo-fake --dry-run
echo '{}' | node cli/kb/bin/kb.js guard
```
