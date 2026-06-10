# Security config — supply-chain hardening reference

Proteções do gerenciador de pacotes contra ataques de supply-chain (postinstall malicioso tipo Shai-Hulud, typosquatting, versões recém-publicadas comprometidas, deps de fontes não confiáveis). A auditoria é feita por `${CLAUDE_PLUGIN_ROOT}/scripts/check-security-config.js`, que emite `findings[]` com `status` e o `edit` (snippet literal) a aplicar.

## A política

| Intenção | pnpm 11+ (`pnpm-workspace.yaml`, camelCase) | pnpm ≤10 / npm (`.npmrc`, kebab) | Valor desejado |
|---|---|---|---|
| Atrasar versões recém-publicadas | `minimumReleaseAge` | `minimum-release-age` | `10080` (minutos = 7 dias) |
| Não atrasar publicações internas | `minimumReleaseAgeExclude` | `minimum-release-age-exclude` | scopes privados (`@scope/*`) |
| Bloquear scripts de deps | `ignoreScripts` **ou** `allowBuilds` (allowlist) | `ignore-scripts` | **adaptativo** (ver abaixo) |
| Versões exatas (sem `^`/`~`) | `savePrefix: ""` | `save-exact=true` | exact |
| Bloquear deps git/tarball transitivas | `blockExoticSubdeps` | `block-exotic-subdeps` | `true` (já é default) |

## Onde as settings moram (version-aware)

- **pnpm 11+**: `.npmrc` lê **apenas auth/registry**. Todas as outras settings vão no `pnpm-workspace.yaml` (camelCase). Setar `minimumReleaseAge`/`savePrefix`/etc no `.npmrc` é **ignorado silenciosamente** no pnpm 11.
- **pnpm 10.16–10.x**: `minimumReleaseAge` suportado; settings em `.npmrc` (kebab) ainda funcionam.
- **pnpm < 10.16**: sem `minimumReleaseAge` — o script reporta `status: "unsupported"` e sugere subir o pnpm. As demais settings vão no `.npmrc`.
- **npm/yarn**: só `ignore-scripts`/`save-exact` no `.npmrc` (best-effort; sem `minimumReleaseAge`/`blockExoticSubdeps`).

O script resolve `targetFile` e `keyStyle` automaticamente a partir do `packageManager`/versão — não assuma o arquivo.

## A nuance `ignoreScripts` × `allowBuilds` (por que adaptativo)

Desde o pnpm 10, **scripts de build de dependências já são bloqueados por padrão**, liberados só via allowlist (`allowBuilds` no `pnpm-workspace.yaml`, ou `pnpm.onlyBuiltDependencies` no `package.json`). Esse é o mecanismo correto contra postinstall malicioso (deny-by-default).

`ignoreScripts: true` é um martelo maior: desliga **todos** os scripts, inclusive os allowlistados e os do próprio projeto. Em repos com deps nativas (sharp, @swc/core, @parcel/watcher…), isso **quebra os builds**.

Por isso o comportamento é adaptativo:
- **`hasBuildAllowlist === true`** → o repo já está protegido. Reporta `status: "ok"` e **não** sugere `ignoreScripts: true` (só uma nota explicando).
- **`hasBuildAllowlist === false`** → sugere `ignoreScripts: true` como default forte (`status: "missing"` se não setado).

## `minimumReleaseAgeExclude` — derivação automática

`minimumReleaseAge` atrasa **toda** versão nova do registry, inclusive pacotes internos. Para não atrasar publicações internas, o script deriva os scopes privados das linhas `@scope:registry=…` do `.npmrc` e propõe excluí-los (ex: `@stone-payments/*`). Deps `workspace:*` não são afetadas (são locais, não vêm do registry). É um finding **opcional** (conveniência, não falha de segurança).

## Como aplicar (tool-agnostic, sem yq)

Cada finding traz `edit` = a(s) linha(s) literais a **garantir** presentes em `targetFile`. Aplique com a ferramenta **Edit** (não dependa de `yq`/`jq` — a sintaxe varia entre o yq Go e o Python):

- **`pnpm-workspace.yaml`**: top-level keys em camelCase. Se a chave já existe, substitua o valor; senão, adicione no fim do arquivo. Ex:
  ```yaml
  minimumReleaseAge: 10080
  minimumReleaseAgeExclude:
    - "@stone-payments/*"
  savePrefix: ""
  ```
  Preserve os blocos existentes (`packages`, `allowBuilds`, `overrides`).
- **`.npmrc`**: uma linha `chave=valor` por setting; só adicione se a chave ainda **não** existir (não duplique). Não toque nas linhas de registry/auth.

Depois de aplicar, rode o script de novo: `allOk` deve virar `true` (findings opcionais podem permanecer). Reaplicar é idempotente — as chaves não se duplicam quando o valor já está correto.

## Caveats

- **pnpm não bloqueia deps git/tarball DIRETAS.** `blockExoticSubdeps` (default `true`) cobre apenas as **transitivas**. Para deps diretas, a defesa é revisão de PR / política de repositório.
- `minimumReleaseAge` no pnpm 11 já tem default `1440` (1 dia); a política sobe para 7 dias.
- Após mexer nessas settings, rode `pnpm install` e revalide o build — especialmente se `ignoreScripts` foi alterado.
