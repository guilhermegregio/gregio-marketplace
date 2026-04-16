---
name: improve-ds
description: "Improve, refine, or extend an existing design system. Add new components, tokens, animations, dark mode, or fix inconsistencies. Run audits to find gaps. Use this skill when the user says 'improve design system', 'melhorar DS', 'add component to DS', 'extend design system', 'refine tokens', 'add dark mode to DS', 'audit design system', 'fix DS inconsistencies', wants to enhance an existing DS, or mentions adding new elements to their design system."
argument-hint: [ds-dir] [--add=<component-names>] [--audit] [--dark-mode] [--a11y]
---

## Your task

ultrathink, com base nos argumentos abaixo:

<arguments>
$ARGUMENTS
</arguments>

Formato: `[ds-dir] [--add=<component-names>] [--audit] [--dark-mode] [--a11y]`

- `ds-dir` (opcional): diretório do DS existente. Default: diretório atual
- `--add=<names>`: componentes a adicionar (separados por vírgula). Ex: `--add=accordion,tabs,toast`
- `--audit`: executar auditoria completa sem fazer mudanças
- `--dark-mode`: adicionar suporte a dark mode
- `--a11y`: auditoria focada em acessibilidade

## Phase 1 — Locate Design System

Procure `design-system.manifest.json` em:
1. `ds-dir` (se fornecido)
2. Diretório atual
3. `./src/` (projetos Astro)

Se não encontrar, informe o usuário e sugira `/extract-ds` ou `/create-ds`.

Leia o manifest e determine o `mode` (astro ou standalone) do campo `mode`.

## Phase 2 — Audit Current DS

Leia todos os arquivos do DS:
- `design-system.manifest.json`
- CSS files (tokens, typography, layout, components, animations)
- Componentes (Astro ou snippets HTML)
- `DESIGN_SYSTEM.md`

### Checklist de auditoria:

**Tokens:**
- [ ] Todas as cores têm contraste AA mínimo (texto sobre background)?
- [ ] Existe paleta de feedback (success, warning, danger)?
- [ ] Spacing scale é consistente?
- [ ] Shadows definidos?
- [ ] Gradients documentados?

**Componentes:**
- [ ] Cada componente tem todos os estados necessários? (hover, focus, disabled, loading)
- [ ] Inputs têm estado de erro?
- [ ] Botões têm variante ghost/icon?
- [ ] Modal tem focus trap?
- [ ] Nav tem versão mobile/responsiva?

**Acessibilidade (se --a11y):**
- [ ] Contraste de cores AA (4.5:1 texto, 3:1 elementos grandes)?
- [ ] Focus visible em todos os interativos?
- [ ] Touch targets mínimo 44px?
- [ ] ARIA roles nos componentes complexos (modal, tabs, accordion)?
- [ ] Reduced motion media query?

**Consistência:**
- [ ] Todos os tokens no manifest estão usados no CSS?
- [ ] Todos os componentes no manifest têm arquivo correspondente?
- [ ] Convenções de prefixo consistentes?

Se `--audit`: reporte os resultados e **pare** (não faça mudanças). Sugira quais melhorias aplicar.

## Phase 3 — Determine Improvements

Se `--add` fornecido: adicionar os componentes listados. Consulte `${CLAUDE_PLUGIN_ROOT}/references/component-catalog.md` para estrutura de cada componente.

Se `--dark-mode`: criar variante dark dos tokens.

Se nenhum flag específico: pergunte ao usuário o que melhorar, apresentando os resultados da auditoria como sugestões.

## Phase 4 — Apply Changes

### Adicionando componentes:
1. Gere CSS em `components.css` (append)
2. Gere componente Astro ou snippet HTML
3. Adicione ao showcase (nova entrada na seção Components)
4. Atualize manifest (array `components`)
5. Atualize `DESIGN_SYSTEM.md`

### Adicionando dark mode:
1. Adicione variantes dark em `tokens.css`:
   ```css
   @media (prefers-color-scheme: dark) {
     :root { /* dark tokens */ }
   }
   /* ou via classe */
   .dark { /* dark tokens */ }
   ```
2. Atualize manifest: `conventions.darkMode = "media"` ou `"class"`
3. Adicione toggle no showcase

### Melhorando acessibilidade:
1. Adicione `focus-visible` styles onde faltam
2. Aumente touch targets < 44px
3. Adicione `prefers-reduced-motion` se ausente
4. Adicione ARIA attributes nos componentes

### Refinando tokens:
1. Atualize valores em `tokens.css`
2. Atualize manifest
3. Verifique cascata (componentes que usam tokens alterados)

## Phase 5 — Validate

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-manifest.js" <ds-dir>/design-system.manifest.json
```

Corrija erros antes de finalizar.

## Phase 6 — Report

Reporte:
1. **Mudanças feitas**: lista de arquivos modificados com resumo
2. **Componentes adicionados**: nomes e variantes
3. **Tokens alterados**: antes → depois
4. **Auditoria pós-melhoria**: status de cada item do checklist
5. Sugira próximos passos (mais melhorias, `/generate-from-ds`, etc.)
