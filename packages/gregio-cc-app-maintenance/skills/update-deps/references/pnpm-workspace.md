# pnpm workspace (sem Nx) — commands reference

## Detect

Sinais que confirmam este tipo:
- `pnpm-workspace.yaml` (ou `.yml`) na raiz
- **Não** existe `nx.json`
- Subpackages em diretórios listados dentro do workspace yaml (`packages/*`, `apps/*`, etc.)

## Validation commands

pnpm não paraleliza por padrão; use `-r` (recursive) e opcionalmente `--workspace-concurrency`:

- lint: `pnpm -r run lint`
- typecheck: `pnpm -r run typecheck`
- test: `pnpm -r run test`
- build: `pnpm -r run build`

**Paralelismo controlado:**
```bash
pnpm -r --workspace-concurrency=3 run build
```

**Filtrar subset:**
```bash
pnpm --filter "@scope/*" run test
pnpm --filter "./apps/web" run build
```

## Dependency update flags

- Base: `pnpx npm-check-updates --workspaces --root`
- Aplicar: `pnpx npm-check-updates -u --workspaces --root`
- Minor only: adicionar `--target minor`
- Filtro: `--filter "<glob>"`

## Gotchas

- **Scripts nem sempre existem em todos os pacotes**: `pnpm -r run <script>` pula quem não tem o script, mas retorna 0 mesmo se o script falhou em alguns. Prefira `pnpm -r --if-present run <script>` para ser explícito, e confira o exit code de cada projeto no output.
- **`workspace:*`**: ncu preserva, mas confirme no `git diff` que nenhum workspace protocol virou versão fixa.
- **`pnpm.overrides` na raiz**: são honrados em todo o workspace. Se atualizou uma lib que está listada em overrides, avise o usuário que provavelmente precisa sincronizar o override também — senão a versão override vai ganhar e a update é silenciosamente ignorada.
- **Ordem de build**: `pnpm -r run build` respeita dependências entre workspace packages (topological). Se houver ciclo, ele reclama.
- **`pnpm install` após bump**: sempre rode; sem isso o lockfile fica fora de sincro e a validação pode mentir.
