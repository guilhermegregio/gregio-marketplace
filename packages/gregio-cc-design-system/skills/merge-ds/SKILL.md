---
name: merge-ds
description: "Merge or combine multiple design systems into one unified DS. Resolve token conflicts, unify component sets, and generate a new cohesive design system. Use this skill when the user says 'merge design systems', 'combine DS', 'combinar design systems', 'unify design tokens', 'merge two DS', or wants to consolidate multiple manifests, combine elements from different design systems, or create a new DS by blending existing ones."
argument-hint: <ds-path-1> <ds-path-2> [dest-dir] [--strategy=<prefer-first|prefer-second|union>]
---

## Your task

ultrathink, com base nos argumentos abaixo:

<arguments>
$ARGUMENTS
</arguments>

Formato: `<ds-path-1> <ds-path-2> [dest-dir] [--strategy=<prefer-first|prefer-second|union>]`

- `ds-path-1`: path do primeiro DS (diretório com `design-system.manifest.json`)
- `ds-path-2`: path do segundo DS
- `dest-dir` (opcional): onde gerar o DS merged. Default: diretório atual
- `--strategy`: como resolver conflitos (default: `prefer-first`)
  - `prefer-first`: mantém valores do primeiro DS em caso de conflito
  - `prefer-second`: mantém valores do segundo DS
  - `union`: mantém ambos (renomeia segundo com sufixo `-alt`)

## Phase 1 — Load Manifests

Leia `design-system.manifest.json` de ambos os paths. Valide que ambos existem e são válidos:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-manifest.js" <ds-path-1>/design-system.manifest.json
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-manifest.js" <ds-path-2>/design-system.manifest.json
```

Se algum for inválido, reporte erros e sugira `/improve-ds` antes de merge.

## Phase 2 — Detect Conflicts

Use o script de merge para detectar conflitos sem aplicar:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/merge-manifests.js" \
  <ds-path-1>/design-system.manifest.json \
  <ds-path-2>/design-system.manifest.json \
  --strategy=<strategy>
```

O script reporta conflitos no stderr. Leia o relatório.

Consulte `${CLAUDE_PLUGIN_ROOT}/references/merge-strategies.md` para regras detalhadas.

## Phase 3 — Resolve Conflicts

Se `--strategy=interactive` ou se há conflitos críticos (convenções diferentes, prefixos incompatíveis):
- Apresente cada conflito ao usuário via `AskUserQuestion`
- Deixe o usuário escolher caso a caso

Conflitos comuns:
- **Tokens com mesmo nome, valores diferentes**: aplique strategy
- **Componentes com mesmo nome, markup diferente**: pergunte qual manter
- **Prefixos diferentes** (`ds-` vs `vivi-`): pergunte qual adotar para o merged
- **Fontes diferentes**: pergunte qual como display/primary/mono

## Phase 4 — Generate Merged DS

1. Detect target stack no `dest-dir`:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-stack.js" <dest-dir>
   ```

2. Gere todos os arquivos CSS do merged (tokens, typography, layout, components, animations) combinando ambos os DSs

3. Gere componentes merged (Astro ou snippets)

4. Gere showcase com **todos** os componentes de ambos os DSs

5. Gere manifest merged (salve output do script):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/merge-manifests.js" \
     <ds-path-1>/design-system.manifest.json \
     <ds-path-2>/design-system.manifest.json \
     --strategy=<strategy> \
     --out=<dest-dir>/design-system.manifest.json
   ```

6. Gere `DESIGN_SYSTEM.md` e `.ds-config.json`

## Phase 5 — Validate & Report

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-manifest.js" <dest-dir>/design-system.manifest.json
```

Reporte:
1. **Tokens merged**: total, quantos de cada DS, conflitos resolvidos
2. **Componentes merged**: total, quais vieram de qual DS
3. **Conflitos**: como cada um foi resolvido
4. **Arquivos criados**
5. Como visualizar o resultado
6. Sugira `/improve-ds --audit` para validar o DS merged
