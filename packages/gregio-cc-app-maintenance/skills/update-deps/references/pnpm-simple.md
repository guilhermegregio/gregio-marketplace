# App pnpm simples (single package) — commands reference

## Detect

Sinais que confirmam este tipo:
- `package.json` na raiz
- **Não** existe `pnpm-workspace.yaml` nem `nx.json`
- Normalmente um único app: Next.js, Astro, Vite, CRA, Remix, SvelteKit, API Node, etc.

## Validation commands

Scripts padrão em `package.json`:
- lint: `pnpm lint`
- typecheck: `pnpm typecheck` (ou `pnpm tsc --noEmit` se o script não existir)
- test: `pnpm test`
- build: `pnpm build`

**Consolidado em uma linha** (para ver rápido o que quebra primeiro):
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Se algum script não existe no `package.json`, **pergunte ao usuário** antes de pular — pode ser que ele chame o tool diretamente (`tsc --noEmit`, `vitest run`, `eslint .`) sem script wrapper.

## Dependency update flags

- Base: `pnpx npm-check-updates` (sem `--workspaces`)
- Aplicar: `pnpx npm-check-updates -u`
- Minor only: adicionar `--target minor`
- Filtro: `--filter "<glob>"`

## Gotchas

- **Script `typecheck` frequentemente ausente**: Next.js e Astro fazem typecheck como parte do build, então muitos devs não criam um script isolado. Se não existe, rode `pnpm exec tsc --noEmit` manualmente; a divergência entre "build passa mas tipo tá errado" é real em projetos com `ignoreBuildErrors: true` no next.config.
- **CI scripts ≠ dev scripts**: alguns repos têm `lint:ci`, `test:ci`. Se existir variante CI, prefira-a na validação — simula o que roda em prod.
- **Sem `pnpm.overrides`? Ótimo.** Em projeto simples raramente há; se houver, trate como no pnpm-workspace.
- **`pnpm install` pode ser lento** em app grande; rode uma vez só após o `ncu -u`, não a cada ajuste de package.json.
