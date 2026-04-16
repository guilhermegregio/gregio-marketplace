---
name: extract-ds
description: "Extract a living design system from a website or local HTML into modular source-of-truth files (tokens, components, animations) + machine-readable manifest + developer guide. Use this skill when the user says 'extract design system', 'extract DS', 'analyze site design', 'pull tokens from website', 'reverse engineer design', 'extrair design system', provides a URL and wants a DS, or has a downloaded site folder and wants to generate a design system from it. Also trigger when the user mentions extracting colors, typography, or components from an existing website."
argument-hint: <url-or-local-path> [dest-dir] [--spa] [--tokens-only] [--react]
---

## Your task

ultrathink, com base nos argumentos abaixo:

<arguments>
$ARGUMENTS
</arguments>

Formato dos argumentos: `<url-or-local-path> [dest-dir] [--spa] [--tokens-only] [--react]`

- `url-or-local-path`: URL do site **ou** path local para uma pasta já baixada (ex.: saída de `/fetch-site`) ou para um arquivo HTML
- `dest-dir` (opcional): onde gerar o design system. Default: diretório atual (`.`)
- `--spa`: quando for URL, força Playwright no download
- `--tokens-only`: extrai apenas tokens (cores, fontes, spacing) sem gerar componentes/showcase
- `--react`: gera também exports consumíveis por React/Next (tokens.ts + component wrappers)

## Phase 0 — Plugin path

Todos os scripts Node desta skill devem ser referenciados via `${CLAUDE_PLUGIN_ROOT}` (variável literal — Claude Code substitui em runtime).

**NÃO tente "descobrir" o path** lendo diretórios, fazendo `ls`, ou usando path hardcoded. Sempre escreva `${CLAUDE_PLUGIN_ROOT}` literal nos comandos shell.

Scripts são executados via `npx --yes --package=...` — nada é instalado permanentemente.

## Phase 1 — Prepare source

Se `url-or-local-path` for URL:
1. Crie `tmpDir = /tmp/ds-source-$(date +%s)`
2. Execute:
   ```bash
   npx --yes --package=cheerio@^1 -- node "${CLAUDE_PLUGIN_ROOT}/scripts/fetch-site.js" <url> --out=<tmpDir>
   ```
   Se `--spa`:
   ```bash
   npx --yes --package=cheerio@^1 --package=playwright@^1.48 -- node "${CLAUDE_PLUGIN_ROOT}/scripts/fetch-site.js" <url> --out=<tmpDir> --spa
   ```
3. `sourceDir = tmpDir/<host-slug>`

Se for path local:
- Se for arquivo HTML, `sourceDir = dirname(path)`, `sourceHtml = path`
- Se for pasta, `sourceDir = path`, `sourceHtml = sourceDir/index.html`

Leia `sourceHtml` e todos os CSS referenciados (via `<link>` ou inline `<style>`). Liste os arquivos JS também (para descobrir observers/animações).

## Phase 2 — Detect target stack

`detect-stack.js` usa só APIs nativas do Node:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-stack.js" <dest-dir>
```

Capture o JSON. O script agora detecta Astro, React, Next, Vue, Nuxt, Tailwind e a presença de DS existente.

Decida o `mode`:
- **`mode = "astro"`** quando `hasAstro === true`
- Caso contrário, pergunte ao usuário via `AskUserQuestion`: *"Não detectei Astro em `<dest-dir>`. Quer criar um projeto Astro novo aqui, ou gerar em HTML standalone?"*
  - "Astro novo" → `mode = "astro"` (criar mini-projeto Astro)
  - "Standalone" → `mode = "standalone"`

Se `--react` e (`hasReact` ou `hasNext`), anote para gerar exports React na Phase 4.

## Phase 3 — Analyze the source

Extraia do HTML + CSS do site original. Consulte `${CLAUDE_PLUGIN_ROOT}/references/token-extraction.md` para regras detalhadas de extração.

1. **Tokens**: cores (hex/rgb em variáveis CSS ou repetidos), font-families (Google Fonts + `font-family:`), spacing scale, easing curves, radii, shadows, gradients, z-index
2. **Tipografia**: tamanho + line-height + weight de `<h1>..<h4>`, parágrafos e labels
3. **Componentes**: classes recorrentes (`.btn`, `.card`, `.nav`, etc.) e variantes. **Use as classes exatas do original.** Se o original usa prefixo (ex.: `ds-`, `vivi-`), preserve-o; se não, adote `ds-`. Consulte `${CLAUDE_PLUGIN_ROOT}/references/component-catalog.md` para o catálogo de componentes reconhecidos.
4. **Animações**: `@keyframes`, classes reveal/hover/shimmer, `transition:` reutilizadas
5. **Layouts**: containers, grids, sections — 2 ou 3 padrões canônicos
6. **Ícones**: se há sistema (`astro-icon`/`iconify`/SVG inline/icon-font), qual é

Se `--tokens-only`: pare aqui. Gere apenas `tokens.css` + `design-system.manifest.json` (só a seção tokens) e reporte. Pule Phases 4-5.

## Phase 4 — Generate output

Copie os templates de `${CLAUDE_PLUGIN_ROOT}/templates/<mode>/` (e `${CLAUDE_PLUGIN_ROOT}/templates/shared/`) para o `dest-dir`, preenchendo marcadores `{{VALUE:...}}` e `{{INSTRUCTION:...}}` com os dados da Phase 3.

### Se `mode === "astro"`:
- `src/pages/design-system.astro`
- `src/components/ds/{Component}.astro` — **apenas** os que aparecem no site original. Use `${CLAUDE_PLUGIN_ROOT}/templates/astro/components/ds/_Component.astro.tmpl` como base.
- `src/styles/design-system/{index,tokens,typography,layout,components,animations}.css`
- Adicione `@import '../styles/design-system/index.css';` no CSS global se ainda não presente

### Se `mode === "standalone"`:
- `<dest-dir>/design-system.html`
- `<dest-dir>/assets/css/{index,tokens,typography,layout,components,animations}.css`
- `<dest-dir>/assets/js/design-system.js`
- `<dest-dir>/assets/snippets/*.html` (apenas componentes presentes no original)

### Em ambos os modos (obrigatório):
- `<dest-dir>/design-system.manifest.json` — schema completo (tokens, components, animations, layoutPatterns, icons, conventions, exports). Consulte `${CLAUDE_PLUGIN_ROOT}/references/manifest-schema.md`.
- `<dest-dir>/DESIGN_SYSTEM.md` — guia preenchido. Se `CLAUDE.md` já existir, anexe seção `## Design System` com link para manifest

### Se `--react`:
- `<dest-dir>/ds-exports/tokens.ts` — typed token constants
- `<dest-dir>/ds-exports/components/*.tsx` — React wrappers usando classes DS
- Consulte `${CLAUDE_PLUGIN_ROOT}/references/react-next-consumption.md`

## Phase 5 — Showcase rules

Consulte `${CLAUDE_PLUGIN_ROOT}/references/showcase-rules.md` para regras completas. Resumo:

**Hero clone (HARD RULE)**: A primeira seção da página showcase **deve ser clone exato do hero original**:
- Mesma estrutura HTML, classes, imagens, animações, botões, background
- **Único texto alterado**: título/subtítulo para apresentar o Design System
- **Proibido**: redesign, remoção de elementos, simplificação

**Seções obrigatórias** (nesta ordem): Hero, Typography, Colors & Surfaces, UI Components, Layout & Spacing, Motion & Interaction, Icons (se existirem)

**Preserve**: classes exatas, timings, easings, keyframes, sistema de ícones, fontes do original

## Phase 6 — Validate

Se o script `validate-manifest.js` estiver disponível:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-manifest.js" <dest-dir>/design-system.manifest.json
```
Corrija erros reportados antes de finalizar.

## Phase 7 — Report

Reporte ao usuário:
1. Lista de arquivos criados
2. Tokens extraídos (cores, fontes, spacing — resumo)
3. Componentes incluídos (e quais foram omitidos por não existirem no original)
4. Como abrir:
   - Astro: `pnpm dev` → `http://localhost:4321/design-system`
   - Standalone: `python3 -m http.server 8080` → `http://localhost:8080/design-system.html`
5. Aponte `DESIGN_SYSTEM.md` e `design-system.manifest.json` como fonte da verdade
6. Se `--react`: mencione os exports em `ds-exports/`
7. Sugira `/improve-ds --audit` para validar e refinar o DS
