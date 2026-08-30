---
block: frontend
profiles: [frontend]
order: 60
version: 2
---

# Perfil: frontend

Esta estação faz frontend. Como no backend, **regra de repo fica na rule** (Astro/DS,
Next client) — `kb rules <repo>` instala; aqui fica só o que é da máquina.

- **`pixelmatch` e `pngjs` já estão instalados globalmente** — use direto para diff de
  imagem, sem adicionar ao projeto.
- **Playwright** é a ferramenta de e2e e de validação visual. Em NixOS o Chromium não vem
  do npm: resolva pelo nixpkgs (`playwright-driver.browsers`). Nunca escreva caminho de
  nix store fixo numa config — o GC apaga e a config quebra.
- **Design system se valida no repo que consome**, não no repo do DS: os e2e e a
  validação visual rodam no app real que importa o DS. Qual é esse repo é do projeto —
  o CLAUDE.md dele diz.
