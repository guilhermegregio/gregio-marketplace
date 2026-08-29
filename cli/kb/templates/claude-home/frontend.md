---
block: frontend
profiles: [frontend]
order: 60
version: 1
---

# Perfil: frontend

Esta estação faz frontend. Como no backend, **regra de repo fica na rule** (Astro/DS,
Next client) — `kb rules <repo>` instala; aqui fica só o que é da máquina.

- **`pixelmatch` e `pngjs` já estão instalados globalmente** — use direto para diff de
  imagem, sem adicionar ao projeto.
- **Playwright** é a ferramenta de e2e e de validação visual. Em NixOS o Chromium não vem
  do npm: resolva pelo nixpkgs (`playwright-driver.browsers`). Nunca escreva caminho de
  nix store fixo numa config — o GC apaga e a config quebra.
- **Consumidor real dos design systems:** `~/code/ds-agent` (monorepo Nx/pnpm, apps Astro
  em `apps/ds-*`) — é onde os e2e de DS rodam.
