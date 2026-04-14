---
description: Download a website (HTML + CSS + JS + images) locally for analysis
---

## Your task

ultrathink, com base nos argumentos abaixo:

<arguments>
$ARGUMENTS
</arguments>

Formato: `<url> [out-dir] [--spa]`

- `url` (obrigatório): URL do site a baixar
- `out-dir` (opcional): pasta de destino. Default: `/tmp/ds-fetch-<timestamp>`
- `--spa` (opcional): usa Playwright para renderizar JS (SPAs, sites JS-heavy)

## Steps

1. Determine o `out-dir`. Se não fornecido, use `/tmp/ds-fetch-$(date +%s)`.
2. Descubra o path do plugin (diretório desta skill) — chame de `PLUGIN_ROOT`. Normalmente disponível via `${CLAUDE_PLUGIN_ROOT}` quando o comando é executado por Claude Code; senão, derive do caminho deste arquivo (`.../gregio-cc-extract-design-system/commands/fetch-site.md` → `PLUGIN_ROOT` é dois níveis acima).
3. Execute **sem instalar nada permanentemente** — as deps são resolvidas on-demand via cache do `npx` (`~/.npm/_npx/`):

   **Default (sites estáticos/SSR):**
   ```
   npx --yes --package=cheerio@^1 -- node "$PLUGIN_ROOT/scripts/fetch-site.js" <url> <out-dir>
   ```

   **Com `--spa` (SPAs / JS-heavy):**
   ```
   npx --yes --package=cheerio@^1 --package=playwright@^1.48 -- node "$PLUGIN_ROOT/scripts/fetch-site.js" <url> <out-dir> --spa
   ```
   Se Chromium não estiver instalado (primeira vez com `--spa`):
   ```
   npx --yes playwright install chromium
   ```

4. Primeira execução: ~5-15s para npx baixar cheerio no cache. Próximas execuções: instantâneas (cache hit).
5. Ao terminar, reporte ao usuário:
   - Pasta de saída
   - Quantidade de assets baixados (lendo `manifest.json` da saída)
   - Caminho do `index.html`
   - Warnings (stderr — assets 4xx/5xx sem abortar)
6. Sugira rodar `/extract-ds <out-dir> <dest-dir>` para gerar o design system.

## Quando usar `--spa`

- O site é uma SPA e o HTML inicial vem vazio/shell
- O download sem `--spa` retornou HTML sem conteúdo significativo
- CSS é carregado dinamicamente via JS

## Por que `npx --yes --package=...`

- **Zero pollution**: nada é instalado no plugin nem no projeto do usuário
- **Cache global**: primeira execução baixa para `~/.npm/_npx/`, próximas reusam
- **Reproduzível**: versão pinada garante mesmo comportamento em qualquer máquina
