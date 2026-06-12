---
name: ds-analyze
description: "Analyze an extracted website cache (.ds-cache) with five specialized parallel agents — tokens/colors, typography, components, motion, layout — consolidating results into a proto-manifest and a gap list against the DS spec. Use this skill when the user wants to analyze an extracted site for design system data, says 'analisar o site extraído', 'analyze the extraction', 'rodar análise do DS', 'extrair tokens/componentes do cache', or when a .ds-cache exists with an approved ds-spec.md and the next pipeline step is needed."
argument-hint: <cache-dir> [--force]
---

## Your task

Com base nos argumentos abaixo:

<arguments>
$ARGUMENTS
</arguments>

Execute a **fase analyze** do pipeline de design system: 5 agentes
especializados em paralelo sobre o cache → `analysis/consolidated.json` +
`analysis/gaps.md` + `analysis/ANALYSIS.md`.

Siga o procedimento completo em `${CLAUDE_PLUGIN_ROOT}/references/pipeline/analyze.md`.
O layout do cache está em `${CLAUDE_PLUGIN_ROOT}/references/cache-layout.md`.

Resumo do contrato:
- Pré-requisitos: `crawl.json` complete + `ds-spec.md` aprovado (senão, aponte a
  fase faltante).
- Se `analysis/consolidated.json` já existe e não há `--force`, apenas reporte o
  existente.
- Dispare os 5 agentes **numa única mensagem** (paralelo real); cada um escreve
  seus outputs no cache e retorna só um sumário.
- A consolidação e os gaps são trabalho seu (main thread), seguindo as regras de
  precedência do pipeline doc.
- Ao final, sugira `/ds-build <cache-dir> <app-dir>`.
