---
name: ds-brainstorm
description: "Brainstorm and capture design system requirements into a ds-spec.md: interview the user about the target app, needed components, source fidelity, dark mode and motion, falling back to a built-in minimum-DS baseline when the user doesn't know what they need. Supports --ref=<ds-app> to take the component inventory/API from an existing reference DS (white-label: same components, new skin). Use this skill when the user wants to define/plan/spec a design system, says 'brainstorm do DS', 'definir requisitos do design system', 'spec the design system', 'o que meu DS precisa', 'DS com os componentes do ds-X', or after a site extraction (.ds-cache) when requirements haven't been captured yet."
argument-hint: <cache-dir> [--ref=<ds-app-dir>] [--baseline]
---

## Your task

Com base nos argumentos abaixo:

<arguments>
$ARGUMENTS
</arguments>

Execute a **fase brainstorm** do pipeline de design system: requisitos do usuário
→ `<cache-dir>/ds-spec.md` aprovado.

Siga o procedimento completo em `${CLAUDE_PLUGIN_ROOT}/references/pipeline/brainstorm.md`.

Resumo do contrato:
- `cache-dir` aponta para uma extração existente (`.ds-cache/<slug>` com `crawl.json`).
  Se não existir, sugira rodar `/ds-extract <url>` primeiro — ou, se o usuário quer
  um DS sem site fonte, prossiga com o baseline e `source_url: none`.
- `--baseline` (ou usuário sem requisitos claros) → aplique
  `${CLAUDE_PLUGIN_ROOT}/references/ds-minimum-baseline.md` direto, sem entrevista longa.
- `--ref=<ds-app-dir>` (ou o usuário citar "componentes do ds-X"/"para o app Y")
  → caso white-label: o inventário e a API de componentes vêm do manifest e dos
  `.astro` do DS de referência; grave `components_ref` no frontmatter do spec.
- O spec final deve ter `status: approved` no frontmatter antes de sugerir a próxima
  fase: `/ds-analyze <cache-dir>`.
