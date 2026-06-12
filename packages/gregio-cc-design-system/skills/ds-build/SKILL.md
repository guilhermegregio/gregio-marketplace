---
name: ds-build
description: "Build a design system as an Astro app in apps/<name> from an analyzed extraction cache: scaffolds the app (ds-agent/Nx pattern), generates build tasks (tokens, component groups, showcase, manifest/docs) and executes them with parallel ds-builder agents in dependency waves. Use this skill when the user wants to build/generate/materialize the DS app, says 'buildar o DS', 'gerar o app do design system', 'criar o app em apps/', or when a ~/.ds-cache has analysis/consolidated.json ready and the app hasn't been built yet."
argument-hint: <cache-dir> <app-name> [app-dir] [--react]
---

## Your task

Com base nos argumentos abaixo:

<arguments>
$ARGUMENTS
</arguments>

Execute a **fase build** do pipeline de design system: scaffold do app Astro em
`apps/<nome>` + tasks em `specs/ds-build/` + execução com agentes `ds-builder`
em waves paralelas.

Siga o procedimento completo em `${CLAUDE_PLUGIN_ROOT}/references/pipeline/build.md`.

Resumo do contrato:
- Pré-requisitos no workspace `<cache-dir>/apps/<app-name>/`:
  `analysis/consolidated.json` + `gaps.md` + `ds-spec.md` aprovado (senão aponte
  a fase faltante: `/ds-analyze` ou `/ds-brainstorm`). `app-dir` default vem do
  spec (`app_dir`).
- `--react` (ou `react_exports: true` no spec) inclui a task de React exports.
- Cada wave dispara os builders **numa única mensagem** (paralelo); entre waves,
  você valida os arquivos e atualiza o `index.css` agregador.
- Fechamento: `pnpm install`, build verde, manifest válido. Sugira
  `/ds-review <app-dir> <cache-dir> <app-name>`.
