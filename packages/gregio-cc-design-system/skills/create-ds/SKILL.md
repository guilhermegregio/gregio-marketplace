---
name: create-ds
description: "Create a new design system from scratch based on references, mood boards, brand guidelines, or aesthetic preferences. Generates tokens, components, showcase page, manifest, and guide. Use this skill when the user says 'create design system', 'new DS', 'criar design system', 'build design tokens from scratch', 'design system from brand guide', 'create DS from references', wants to create a DS without extracting from a single website, or wants to combine elements from multiple reference sites into a new creative DS."
argument-hint: [dest-dir] [--from=<reference-urls-or-paths>] [--style=<aesthetic>] [--react]
---

## Your task

ultrathink, com base nos argumentos abaixo:

<arguments>
$ARGUMENTS
</arguments>

Formato: `[dest-dir] [--from=<urls-or-paths>] [--style=<aesthetic>] [--react]`

- `dest-dir` (opcional): onde criar o DS. Default: diretório atual
- `--from=<urls-or-paths>`: URLs ou paths locais de referência (separados por vírgula)
- `--style=<aesthetic>`: estética desejada (luxury, minimal, brutalist, playful, corporate, tech, dark, light)
- `--react`: gera também exports consumíveis por React/Next

## Phase 1 — Gather Requirements

Use `AskUserQuestion` para coletar (se não fornecido nos argumentos):

1. **Nome do projeto/marca** — como chamar o DS
2. **Estética** — luxury, minimal, brutalist, playful, corporate, tech, etc.
3. **Referências** — URLs de sites inspiração, paths de sites baixados, ou screenshots
4. **Preferências de cores** — cores da marca, paleta desejada, dark/light
5. **Preferências de fontes** — serif, sans-serif, mono, fontes específicas
6. **Componentes necessários** — quais componentes incluir (ou "todos os básicos")
7. **Plataformas alvo** — Astro, standalone, React/Next

Se o usuário já forneceu informações suficientes na conversa, não pergunte novamente — extraia dos argumentos e contexto.

## Phase 2 — Fetch References (se URLs fornecidas)

Para cada URL em `--from`:
```bash
npx --yes --package=cheerio@^1 --package=playwright@^1.48 -- node "${CLAUDE_PLUGIN_ROOT}/scripts/fetch-site.js" <url> --out=/tmp/ds-ref-$(date +%s)
```

Analise cada referência: extraia elementos visuais interessantes (animações, efeitos, patterns, componentes) que combinam com a estética escolhida. O objetivo não é copiar, mas se **inspirar criativamente**.

## Phase 3 — Detect Target Stack

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-stack.js" <dest-dir>
```

Mesma lógica do `/extract-ds`: detecta Astro → `mode = "astro"`, senão pergunta ao usuário.

## Phase 4 — Synthesize Tokens

Crie um sistema de tokens coerente baseado nas referências + preferências:

1. **Cores**: defina paleta completa (primary com dark/light, accent, surfaces, feedback). Se tem referências, extraia as cores mais impactantes. Garanta contraste AA mínimo.
2. **Fontes**: escolha 2-3 famílias que combinam com a estética. Google Fonts preferencialmente.
3. **Typography scale**: defina h1→h4, body-lg/body/body-sm, label. Proporção harmônica.
4. **Spacing**: escala baseada em 4px (4, 8, 12, 16, 24, 32, 48, 64, 96)
5. **Radii, easing, shadows, gradients**: coerentes com a estética

Consulte `${CLAUDE_PLUGIN_ROOT}/references/token-extraction.md` para categorias completas.

## Phase 5 — Design Components

Consulte `${CLAUDE_PLUGIN_ROOT}/references/component-catalog.md` para o catálogo completo.

Gere componentes apropriados à estética e necessidades do usuário. Mínimo:
- Button (primary, secondary, ghost)
- Card (default + 1-2 variantes)
- Input (text, com estados focus/error)
- Badge
- Nav (sticky)
- Hero

Adicione conforme solicitado: Modal, Accordion, Tabs, Toast, Footer, Sidebar, etc.

## Phase 6 — Generate Output

Use os mesmos templates de `${CLAUDE_PLUGIN_ROOT}/templates/`. Consulte:
- `${CLAUDE_PLUGIN_ROOT}/references/astro-integration.md` para modo Astro
- `${CLAUDE_PLUGIN_ROOT}/references/standalone-integration.md` para modo standalone

Gere todos os arquivos: CSS modulares, componentes, showcase, manifest, guide.

### Showcase — Hero CRIATIVO (diferente do /extract-ds)

Na criação do zero, o hero NÃO é clone — é uma **demonstração criativa** das capacidades do DS:
- Animações de entrada (reveal-up, char-reveal)
- Efeitos em botões (hover-lift, hover-glow)
- Background elegante (gradient, animação sutil)
- Imagens/ilustrações se referências forneceram
- Tipografia impactante
- Detalhes: glow, partículas, arabescos se compatível com estética

Consulte `${CLAUDE_PLUGIN_ROOT}/references/showcase-rules.md` (seção "Creative Creation Rules").

### Seções do showcase (mesma ordem):
0. Hero criativo
1. Typography (spec table)
2. Colors & Surfaces (swatches)
3. UI Components (todos com estados)
4. Layout & Spacing (2-3 patterns)
5. Motion & Interaction (motion gallery)
6. Icons (se aplicável)

## Phase 7 — React Exports (se --react)

Consulte `${CLAUDE_PLUGIN_ROOT}/references/react-next-consumption.md`.
Gere `ds-exports/tokens.ts` e `ds-exports/components/*.tsx`.

## Phase 8 — Validate & Report

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-manifest.js" <dest-dir>/design-system.manifest.json
```

Reporte:
1. Arquivos criados
2. Tokens definidos (resumo)
3. Componentes criados
4. Como visualizar
5. Sugira `/improve-ds` para refinar e `/generate-from-ds` para criar páginas
