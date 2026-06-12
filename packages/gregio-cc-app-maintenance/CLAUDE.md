# gregio-cc-app-maintenance — guia do mantenedor

Plugin de manutenção recorrente de apps Node: hoje uma skill (`update-deps`)
com auditoria de supply-chain integrada. O README cobre o uso; aqui estão as
convenções que um refactor precisa preservar. Leia também o `CLAUDE.md` da raiz.

## Arquitetura

`skills/update-deps/SKILL.md` em fases sequenciais:
detect (0) → security (S) → pre-flight (1) → discovery (2) → update →
validate (4: lint/typecheck/test/build com até 3 tentativas de fix) →
visual (5, opcional) → commit (6).

Scripts de detecção em `scripts/` (Node ESM, sem deps):
- `detect-repo-type.js` → `{type: nx|pnpm-workspace|pnpm-simple, pkgManager, hasOverrides, hasPatches, nxVersionMismatch, ...}`
- `has-dev-server.js` → framework/script/porta para a validação visual
- `check-security-config.js` → findings com snippets `edit` literais

References por tipo de repo (dentro da skill, não na raiz do pacote):
`skills/update-deps/references/{nx,pnpm-workspace,pnpm-simple}.md` +
`security-config.md` + `visual-validation.md`.

## Convenções a preservar

1. **Agnosticismo via Phase 0**: o pacote não assume formato de repo — toda
   skill nova DESTE pacote deve começar rodando `detect-repo-type.js` e
   ramificar pelos references por tipo. É a identidade do plugin.
2. **pnpm version awareness**: pnpm ≥ 11 configura segurança em
   `pnpm-workspace.yaml` (camelCase: `minimumReleaseAge`); pnpm ≤ 10 usa
   `.npmrc` (kebab-case). O `check-security-config.js` decide o `targetFile` e
   emite snippets **literais** em `findings[].edit` — aplicáveis com a tool
   Edit sem tradução. Mudar o formato dos findings quebra a Phase S do SKILL.md.
3. **Comportamento adaptativo de segurança**: se o repo já usa `allowBuilds`,
   não forçar `ignoreScripts` (são estratégias alternativas, não cumulativas).
4. **Nx monorepos**: pacotes `nx`/`@nx/*` sempre na MESMA versão
   (`nxVersionMismatch` detecta); preservar `workspace:*`.
5. **Git**: nunca `--no-verify` (pre-commit hooks são parte da validação);
   rollback documentado = `git checkout -- . && pnpm install` a partir do HEAD
   guardado na Phase 1.

## Como testar

- Scripts isolados: `node scripts/detect-repo-type.js <repo>` num Nx real
  (`~/code/ds-agent` serve) e num pnpm simples — conferir o JSON.
- Skill completa: rodar `/update-deps check` (só discovery, sem mudanças) no
  ds-agent; depois `minor` num repo descartável até o commit final.

## Versionamento

Bump em `.claude-plugin/plugin.json` E na entrada do
`.claude-plugin/marketplace.json` da raiz.
