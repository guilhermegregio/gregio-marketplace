# Nx monorepo — commands reference

## Detect

Sinais que confirmam este tipo:
- `nx.json` na raiz
- `project.json` em pelo menos um subdiretório de `packages/`, `apps/`, ou `libs/`
- Frequentemente `pnpm-workspace.yaml` também existe (pnpm é o pm padrão do Nx moderno)

## Validation commands

**Preferido (paralelo, consolidado):**
```bash
pnpm nx run-many -t lint,typecheck,test,build --parallel=3
```

**Se `affected` estiver configurado e houver base git** (acelera muito em CI):
```bash
pnpm nx affected -t lint,typecheck,test,build --parallel=3 --base=HEAD~1
```

**Fallback por tipo (se um dos targets não existir em todos os projects):**
- lint: `pnpm nx run-many -t lint --parallel=3`
- typecheck: `pnpm nx run-many -t typecheck --parallel=3`
- test: `pnpm nx run-many -t test --parallel=3`
- build: `pnpm nx run-many -t build --parallel=3`

## Dependency update flags

- Base: `pnpx npm-check-updates --workspaces --root`
- Aplicar: `pnpx npm-check-updates -u --workspaces --root`
- Minor only: adicionar `--target minor`
- Filtro: `--filter "<glob>"`

## Gotchas

- **Versões do Nx**: `nx`, `@nx/*`, e qualquer `@nrwl/*` legado TÊM que estar na mesma versão major/minor. O detect script reporta `nxVersionMismatch`; se presente, corrija antes de prosseguir.
- **Plugins de community**: nem todo `@nx/<plugin>` vai na mesma versão — só os oficiais. `@nx-tools/*` por ex. tem versionamento próprio.
- **Migrations**: após bump de Nx, rode `pnpm nx migrate latest` se o major mudou. Isso atualiza generators e schematics. Depois `pnpm install` e commit do `migrations.json`.
- **Cache**: se build falhar estranho após bump, rode `pnpm nx reset` para limpar o cache do Nx.
- **`parallel=3`** é conservador; ajuste via `--parallel=<N>` conforme CPU.
