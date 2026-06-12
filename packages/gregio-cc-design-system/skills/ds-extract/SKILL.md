---
name: ds-extract
description: "Crawl and download a full website (multiple pages, assets, screenshots, computed styles) into a local offline cache for design system work. Use this skill whenever the user wants to extract/download/fetch a site for analysis, says 'extrair site', 'baixar site', 'crawl this site', 'fetch website for design system', 'download site for offline analysis', or provides a URL that will later feed design system creation. Also use it to refresh or extend an existing ~/.ds-cache extraction."
argument-hint: <url> [--max-pages=10] [--max-depth=2] [--click=<selector>] [--include=re] [--exclude=re] [--no-mobile] [--sections] [--force]
---

## Your task

Com base nos argumentos abaixo:

<arguments>
$ARGUMENTS
</arguments>

Execute a **fase extract** do pipeline de design system: crawl Playwright-only do
site para o cache global reutilizável em `~/.ds-cache/<site-slug>/` (compartilhado
entre projetos).

Siga o procedimento completo em `${CLAUDE_PLUGIN_ROOT}/references/pipeline/extract.md`.
O contrato do cache gerado está em `${CLAUDE_PLUGIN_ROOT}/references/cache-layout.md`.

Resumo do contrato:
- Scripts sempre via `${CLAUDE_PLUGIN_ROOT}` literal (nunca descubra o path manualmente).
- Se o cache já existe completo, o crawler reporta `cached: true` e não toca na
  rede; se as flags pedirem MAIS que o cache tem (`--max-depth`/`--max-pages`
  maiores, `--click` novo...), ele re-crawla automaticamente (`recrawled: true` +
  motivos) preservando os workspaces em `<site>/apps/`. `--force` fica só para
  "dados frescos" explícito.
- Ao final, reporte páginas/assets/screenshots, avalie a qualidade da extração
  (computed.json populado? screenshots ok?) e sugira o próximo passo: `/ds-brainstorm`
  (ou `/ds-create` para o pipeline completo).
