---
description: Extract a living design system (tokens, components, animations) from a website into modular source-of-truth files + agent-consumable manifest & guide
---

## Your task

ultrathink, com base nos argumentos abaixo:

<arguments>
$ARGUMENTS
</arguments>

Formato dos argumentos: `<url-or-local-path> [dest-dir] [--spa]`

- `url-or-local-path`: URL do site **ou** path local para uma pasta já baixada (ex.: saída de `/fetch-site`) ou para um arquivo HTML
- `dest-dir` (opcional): onde gerar o design system. Default: diretório atual (`.`)
- `--spa`: quando `url-or-local-path` for URL, força Playwright no download

## Phase 0 — Plugin path

Todos os scripts Node desta skill devem ser referenciados via `${CLAUDE_PLUGIN_ROOT}` (variável literal — Claude Code substitui em runtime pelo path da skill, seja em dev local ou instalada via plugin manager em `~/.claude/plugins/cache/...`).

**NÃO tente "descobrir" o path lendo diretórios, fazendo `ls`, ou usando path hardcoded como `/home/.../gregio-marketplace/...`.** Sempre escreva `${CLAUDE_PLUGIN_ROOT}` literal nos comandos shell.

Scripts são executados via `npx --yes --package=...` — **nada é instalado permanentemente** nem no plugin nem no projeto alvo. As deps ficam no cache global do npx (`~/.npm/_npx/`).

## Phase 1 — Prepare source

Se `url-or-local-path` for URL:
1. Crie `tmpDir = /tmp/ds-source-$(date +%s)`
2. Execute:
   ```
   npx --yes --package=cheerio@^1 -- node "${CLAUDE_PLUGIN_ROOT}/scripts/fetch-site.js" <url> <tmpDir>
   ```
   Se `--spa`:
   ```
   npx --yes --package=cheerio@^1 --package=playwright@^1.48 -- node "${CLAUDE_PLUGIN_ROOT}/scripts/fetch-site.js" <url> <tmpDir> --spa
   ```
3. `sourceDir = tmpDir`

Se for path local:
- Se for arquivo HTML, `sourceDir = dirname(path)`, `sourceHtml = path`
- Se for pasta, `sourceDir = path`, `sourceHtml = sourceDir/index.html`

Leia `sourceHtml` e todos os CSS referenciados (via `<link>` ou inline `<style>`). Liste os arquivos JS também (para descobrir observers/animações).

## Phase 2 — Detect target stack

`detect-stack.js` usa só APIs nativas do Node, então roda direto:
```
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-stack.js" <dest-dir>
```

Capture o JSON. Decida o `mode`:

- **`mode = "astro"`** quando `hasAstro === true`
- **`mode = "standalone"`** caso contrário — MAS antes de continuar, use `AskUserQuestion` com a pergunta: *"Não detectei Astro em `<dest-dir>`. Quer criar um projeto Astro novo aqui, ou gerar o design system em HTML standalone?"* com opções:
  - "Astro novo" — cria mini-projeto Astro (`package.json`, `astro.config.mjs`, `src/`) e usa `mode = "astro"`
  - "Standalone" — gera `design-system.html` + `assets/css`/`js`/`snippets` no `dest-dir`

## Phase 3 — Analyze the source

Extraia do HTML + CSS do site original:

1. **Tokens**: cores usadas (hex/rgb encontrados em variáveis ou repetidos nos componentes), font-families (tags `<link>` Google Fonts + `font-family:` no CSS), spacing scale (valores comuns em padding/margin/gap), easing curves, radii.
2. **Tipografia**: encontre cada tamanho + line-height + weight de `<h1>..<h4>`, parágrafos e labels.
3. **Componentes**: identifique cada classe recorrente (`.btn`, `.card`, `.nav`, etc.) e suas variantes. **Use as classes exatas do original** — não renomeie. Se o original usa prefixo (ex.: `ds-`, `vivi-`), preserve-o; se não, adote `ds-` como prefixo.
4. **Animações**: `@keyframes`, classes reveal/hover/shimmer, `transition:` reutilizadas.
5. **Layouts**: containers, grids, sections — 2 ou 3 padrões canônicos.
6. **Ícones**: se há sistema (`astro-icon`/`iconify`/SVG inline/icon-font), qual é.

## Phase 4 — Generate output

Copie os templates de `${CLAUDE_PLUGIN_ROOT}/templates/<mode>/` (e `${CLAUDE_PLUGIN_ROOT}/templates/shared/`) para o `dest-dir`, preenchendo placeholders `{{...}}` com os dados da Fase 3.

### Se `mode === "astro"`:
- `src/pages/design-system.astro` — a partir de `templates/astro/pages/design-system.astro.tmpl`
- `src/components/ds/{Button,Card,Badge,Input,Modal,Nav,Hero}.astro` — incluir **apenas** os que aparecem no site original
- `src/styles/design-system/{index,tokens,typography,layout,components,animations}.css` — a partir dos `.css.tmpl`
- **Importante**: adicione `@import '../styles/design-system/index.css';` no CSS global do projeto (ou em `BaseLayout.astro`) se ainda não estiver importado

### Se `mode === "standalone"`:
- `<dest-dir>/design-system.html`
- `<dest-dir>/assets/css/{index,tokens,typography,layout,components,animations}.css`
- `<dest-dir>/assets/js/design-system.js`
- `<dest-dir>/assets/snippets/*.html` (apenas componentes presentes no site original)

### Em ambos os modos (obrigatório — saídas compartilhadas):
- `<dest-dir>/design-system.manifest.json` — preencher schema completo (tokens, components, animations, layoutPatterns, icons, conventions)
- `<dest-dir>/DESIGN_SYSTEM.md` — preencher template; se `CLAUDE.md` já existir no destino, **em vez de criar arquivo novo**, anexe uma seção `## Design System` com link para `design-system.manifest.json` e resumo das regras

## Phase 5 — Hero clone rule (hard)

A primeira seção da página showcase (Astro ou HTML) **deve ser um clone exato do hero do site original**:
- Mesma estrutura HTML
- Mesmas classes
- Mesmas imagens (ou placeholders com mesmos atributos)
- Mesmas animações/partículas/arabescos
- **Único texto alterado**: título/subtítulo para apresentar o Design System
- Proibido: redesign, substituição de elementos, simplificação

## Phase 6 — Preserve original references

- **Não reinvente estilos**: preserve classes, timings, easings, keyframes do original
- **Não inclua componentes que não existem** no site de referência
- **Preserve o sistema de ícones** original (ex.: se usa `solar:*` via iconify, mantenha)
- **Preserve fontes** (Google Fonts links) no `<head>` ou na config Astro

## Phase 7 — Report

Ao terminar, reporte ao usuário:
1. Lista de arquivos criados
2. Tokens extraídos (cores, fontes, spacing — resumo rápido)
3. Componentes incluídos (e quais foram omitidos por não existirem no original)
4. Como abrir o resultado:
   - Astro: `pnpm dev` e `http://localhost:4321/design-system`
   - Standalone: `python3 -m http.server 8080` em `<dest-dir>` e abrir `http://localhost:8080/design-system.html`
5. Aponte para `DESIGN_SYSTEM.md` e `design-system.manifest.json` como fonte da verdade para criações futuras

## Reference (regras técnicas originais)

O arquivo `${CLAUDE_PLUGIN_ROOT}/extract-design-system.md` contém as regras detalhadas do showcase (hero clone, ordem de seções, regras de tipografia). Consulte-o quando estiver em dúvida sobre convenções das seções.
