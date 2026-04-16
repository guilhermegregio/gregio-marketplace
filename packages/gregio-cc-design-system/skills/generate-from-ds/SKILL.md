---
name: generate-from-ds
description: "Generate components, pages, sections, or full layouts using an existing design system as source of truth. Supports output for Astro, React/Next, and standalone HTML. Use this skill when the user says 'generate page from DS', 'gerar página do design system', 'create component using design system', 'build landing page from tokens', 'use DS to create', 'generate from design system', wants to produce UI artifacts that follow an established design system, or asks to create new pages/components while a design-system.manifest.json exists in the project."
argument-hint: <what-to-generate> [--ds=<manifest-path>] [--target=<astro|react|next|standalone>]
---

## Your task

ultrathink, com base nos argumentos abaixo:

<arguments>
$ARGUMENTS
</arguments>

Formato: `<what-to-generate> [--ds=<manifest-path>] [--target=<astro|react|next|standalone>]`

- `what-to-generate`: descrição do que criar (ex: "landing page", "pricing section", "dashboard layout", "ProductCard component")
- `--ds=<path>`: path para `design-system.manifest.json`. Default: auto-detect no projeto
- `--target=<framework>`: framework de saída. Default: auto-detect via `detect-stack.js`

## Phase 1 — Locate Design System

Procure `design-system.manifest.json`:
1. Path em `--ds`
2. Diretório atual
3. `./src/` (Astro)
4. Projeto pai

Se não encontrar, informe e sugira `/extract-ds` ou `/create-ds`.

Leia o manifest inteiro — este é a **fonte da verdade**. Todo código gerado deve usar APENAS tokens e componentes definidos nele.

## Phase 2 — Detect Target Framework

Se `--target` não fornecido:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-stack.js" .
```

Prioridade de detecção:
1. `hasAstro` → target = `astro`
2. `hasNext` → target = `next`
3. `hasReact` → target = `react`
4. Fallback → target = `standalone`

## Phase 3 — Parse Request

Interprete `what-to-generate`:

- **"component X"** → criar um componente individual
- **"page X"** → criar uma página completa
- **"section X"** → criar uma seção reutilizável
- **"layout X"** → criar um layout/template
- **Descrição livre** → interpretar e criar o artefato mais apropriado

## Phase 4 — Load DS Context

Do manifest, carregue em contexto:
- **Tokens disponíveis**: todas as cores, fontes, spacing, etc.
- **Componentes disponíveis**: quais podem ser usados, suas variantes e props
- **Animações disponíveis**: quais classes de animação existem
- **Convenções**: prefixo, responsivo, dark mode

Leia também `DESIGN_SYSTEM.md` para regras de composição.

## Phase 5 — Generate

### Target: Astro
Consulte `${CLAUDE_PLUGIN_ROOT}/references/astro-integration.md`.

- Use componentes DS existentes via `import`:
  ```astro
  import Button from '../components/ds/Button.astro';
  import Card from '../components/ds/Card.astro';
  ```
- CSS via tokens (custom properties)
- Layout com classes DS (`.ds-container`, `.ds-grid-*`, `.ds-section`)
- Animações via classes (`.reveal-up`, `.delay-*`)
- Se componente novo necessário e não existe no DS: crie seguindo o padrão dos existentes, mas **avise o usuário** que deve atualizar o DS via `/improve-ds`

### Target: React / Next
Consulte `${CLAUDE_PLUGIN_ROOT}/references/react-next-consumption.md`.

- Importe `tokens.css` no root
- Use typed token constants de `tokens.ts` (se disponível)
- Use React wrappers de `ds-exports/components/` (se disponível)
- Se wrappers não existem, gere componentes usando classes DS diretamente:
  ```tsx
  <button className="ds-btn ds-btn-primary">Click</button>
  ```
- TypeScript strict: types para todas as props

### Target: Standalone
Consulte `${CLAUDE_PLUGIN_ROOT}/references/standalone-integration.md`.

- HTML puro usando classes DS
- Link para `assets/css/index.css`
- Script para `assets/js/design-system.js`
- Sem dependências de framework

## Phase 6 — Validate

Verifique que o código gerado:
- [ ] Usa APENAS tokens do manifest (sem cores/fontes hardcoded)
- [ ] Usa APENAS componentes do manifest (sem inventar classes)
- [ ] Segue convenções do manifest (prefixo, responsivo, dark mode)
- [ ] É responsivo (mobile-first)
- [ ] Tem acessibilidade básica (alt texts, roles, focus)

Se alguma violação: corrija antes de entregar.

## Phase 7 — Report

Reporte:
1. Arquivo(s) criado(s) com paths
2. Componentes DS utilizados
3. Tokens DS utilizados
4. Se criou algo que não está no DS: avise e sugira `/improve-ds --add=<novo>`
5. Como visualizar o resultado
