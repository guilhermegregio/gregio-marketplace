# gregio-cc-harness — manutenção

CLI de bootstrap do harness (plano `harness-vnext`, T06). Um único script
(`scripts/harness.mjs`, Node ESM ≥ 20, zero deps) com `doctor`, `map` e
`install <repo>`. É a evolução prevista no CLAUDE.md do `gregio-cc-rules`.

## Contratos que não podem regredir

- **Check só entra com cicatriz.** Cada check do doctor rastreia uma dor real:
  plugin instalado mas desabilitado em `enabledPlugins` passou semanas
  despercebido; credencial n8n dev apontando pra prod
  (`auth.nxttrainingapp.com`) queimou dados reais; guard.mjs ausente deixa o
  freeze/wtree sem guardrail. Não remova um check sem registrar o porquê.
- **`doctor` sai com 1 se qualquer ✗** — automação depende do exit code, não do
  texto. Check pulado (docker/n8n ausente) imprime `-` e não conta como falha.
- **`install` NUNCA duplica a lógica de rules.** Delega ao
  `gregio-cc-rules/scripts/install-rules.mjs` via spawn — auto-detecção de
  stack, idempotência e `--prune` têm dono único. `findInstallRules()` tenta o
  path irmão (checkout/worktree) e os layouts do plugin cache; se mudar o layout
  do marketplace, é ali que se ajusta.
- **Escrita em `settings.json` é idempotente e com backup.** O guard é
  identificado por `guard.mjs` no `command` (o matcher pode evoluir); backup
  `.bak` antes de qualquer escrita; settings ilegível (JSON corrompido) aborta
  em vez de sobrescrever. `map` não executa nada — só sugere `kb project add`.
- **`XDG_CONFIG_HOME` é respeitado** para localizar o kb config — NixOS e
  ambientes de teste dependem disso.

## Armadilhas conhecidas

- `map` considera registrado quem está em `projects` **ou** `vaults` do kb
  config — vaults são repos git em `~/code`, mas registrá-los como project
  seria errado.
- Plugins com scope `project`/`local` não são cobrados em `enabledPlugins`
  global (são habilitados por projeto); o doctor só valida scope `user`.
- A query do n8n roda dentro do container `postgres-dev` com
  `$POSTGRES_USER` expandido pelo `sh -c` **de dentro** do container — não
  troque por expansão local.

## Testes manuais

```bash
node --check scripts/harness.mjs
node scripts/harness.mjs doctor          # exit 1 é resultado válido se houver ✗ real
node scripts/harness.mjs map
node scripts/harness.mjs install /tmp/repo-fake --dry-run
```

## `status` — contratos

- **`warn` vs `info`**: `warn` = "você perde trabalho se ignorar" (uncommitted, ahead,
  stash, branch não mergeada); `info` = contexto (worktree ativo, behind). O exit 1 só
  conta `warn` — quem usa isso em CI/hook não pode ser interrompido por informação.
- **Nunca apaga nada.** Diretório órfão em `~/code/worktrees` é REPORTADO com o `rm -rf`
  pronto para copiar; executar por conta própria seria apagar trabalho que o git já não
  consegue recuperar.
- **1 nível de profundidade** em `~/code`: monorepo é um repo, não varremos dentro.
- **Branch principal** é `main` ou `master`, o que existir; sem nenhuma das duas, o
  check de branch não mergeada é pulado (não inventa base de comparação).
- **Dono estranho**: a varredura de `foreignOwner` é rasa (4 níveis) e para no primeiro
  achado — o objetivo é decidir QUAL dica mostrar, não inventariar o diretório. Falha de
  leitura conta como dono estranho (não conseguir listar já é o sintoma).
- **Sem repos ≠ sem trabalho**: `status` continua checando os órfãos de
  `<base>/worktrees` mesmo quando não há nenhum repo git na base.
