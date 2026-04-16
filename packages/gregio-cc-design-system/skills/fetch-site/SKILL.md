---
name: fetch-site
description: "Download a website (HTML + CSS + JS + images + fonts) locally for offline analysis. Handles both static sites and SPAs with auto-detection. Use this skill when the user says 'download site', 'fetch website', 'save page locally', 'baixar site', 'download page for analysis', or needs a local copy of any website for design system extraction or analysis. Always use this before /extract-ds when starting from a URL."
argument-hint: <url...> [out-dir] [--spa] [--no-spa] [--file=urls.txt] [--screenshot]
---

## Your task

ultrathink, com base nos argumentos abaixo:

<arguments>
$ARGUMENTS
</arguments>

Formato: `<url...> [out-dir] [--spa] [--no-spa] [--file=urls.txt] [--screenshot]`

- `url` (obrigatório): Uma ou mais URLs do site a baixar
- `out-dir` (opcional): pasta de destino. Default: `./ds-fetch` no diretório atual
- `--spa`: força Playwright (pula detecção automática)
- `--no-spa`: usa apenas cheerio (nunca tenta playwright)
- `--file=<path>`: arquivo .txt com URLs (1 por linha, `#` = comentário)
- `--screenshot`: salvar screenshot full-page (só em modo playwright)
- `--max-assets=<n>`: limite de assets por URL (default: 800)
- `--max-img=<n>`: limite de imagens por URL (default: 200)

## Plugin path

Todos os scripts devem ser referenciados via `${CLAUDE_PLUGIN_ROOT}` literal — Claude Code substitui em runtime. **NÃO** tente descobrir o path via `ls` ou path hardcoded.

## Comportamento padrão (sem --spa nem --no-spa)

1. Tenta cheerio primeiro (rápido, sem browser, ~1-3s por URL)
2. Analisa HTML — se detectar SPA (body vazio, `#root`/`#app` sem filhos, poucos elementos vs muitos `<script>`) → retenta automaticamente com playwright
3. Mantém o melhor resultado

## Steps

1. Determine o `out-dir`. Se não fornecido, use o diretório atual + `ds-fetch`.
2. Separe URLs dos argumentos (tudo que começa com `http://` ou `https://`) do out-dir (argumento que não é URL nem flag).
3. Execute sem instalar nada permanentemente:

   ```bash
   npx --yes --package=cheerio@^1 --package=playwright@1.58.2 -- node "${CLAUDE_PLUGIN_ROOT}/scripts/fetch-site.js" <urls...> --out=<out-dir> [flags]
   ```

   **Sempre** inclua ambos `--package=cheerio@^1` e `--package=playwright@1.58.2` no npx, mesmo sem `--spa`.

   **NixOS**: O script detecta `/etc/NIXOS` automaticamente e configura Playwright. Não é necessário nenhum export manual.

   Se Chromium não estiver instalado (primeira vez):
   ```bash
   npx --yes playwright install chromium
   ```

4. Ao terminar, leia o `summary.json` e reporte:
   - Pasta de saída
   - Por URL: modo usado (cheerio/playwright), assets baixados, se detectou SPA
   - Caminho do `index.html` de cada URL
5. Sugira rodar `/extract-ds <out-dir>/<slug> <dest-dir>` para gerar o design system.

## Quando usar `--spa`

- Site é SPA e HTML inicial vem vazio/shell
- Download sem `--spa` retornou HTML sem conteúdo significativo
- CSS carregado dinamicamente via JS
- Sabe que o site é JS-heavy (React, Vue, Angular sem SSR)

Na maioria dos casos, **não use nenhum flag** — o script detecta automaticamente.
