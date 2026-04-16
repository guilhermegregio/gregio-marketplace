---
description: Download a website (HTML + CSS + JS + images) locally for analysis
---

## Your task

ultrathink, com base nos argumentos abaixo:

<arguments>
$ARGUMENTS
</arguments>

Formato: `<url...> [out-dir] [--spa] [--no-spa] [--file=urls.txt]`

- `url` (obrigatório): Uma ou mais URLs do site a baixar
- `out-dir` (opcional): pasta de destino. Default: `./ds-fetch` no diretório atual do usuário
- `--spa` (opcional): força Playwright (pula detecção automática)
- `--no-spa` (opcional): usa apenas cheerio (nunca tenta playwright)
- `--file=<path>` (opcional): arquivo .txt com URLs (1 por linha, `#` = comentário)
- `--screenshot` (opcional): salvar screenshot full-page por URL (só em modo playwright)

## Comportamento padrão (sem --spa nem --no-spa)

1. Tenta cheerio primeiro (rápido, sem browser, ~1-3s por URL)
2. Analisa o HTML — se detectar SPA (body vazio, `#root`/`#app` sem filhos, poucos elementos de conteúdo vs muitos `<script>`) → **retenta automaticamente com playwright**
3. Mantém o melhor resultado

## Steps

1. Determine o `out-dir`. Se não fornecido, use o diretório atual + `ds-fetch`.
2. Separe as URLs dos argumentos (tudo que começa com `http://` ou `https://`) do out-dir (argumento que não é URL nem flag).
3. Execute **sem instalar nada permanentemente** — deps são resolvidas via cache do `npx`. Use literalmente `${CLAUDE_PLUGIN_ROOT}` — o Claude Code substitui pelo path do plugin.

   ```
   npx --yes --package=cheerio@^1 --package=playwright@1.58.2 -- node "${CLAUDE_PLUGIN_ROOT}/scripts/fetch-site.js" <urls...> --out=<out-dir> [flags]
   ```

   **Importante**: SEMPRE inclua ambos `--package=cheerio@^1` e `--package=playwright@1.58.2` no npx, mesmo sem `--spa`. O script decide internamente qual usar, e se precisar do playwright para fallback automático ele já estará disponível.

   **NixOS**: O script detecta `/etc/NIXOS` automaticamente e seta `PLAYWRIGHT_BROWSERS_PATH`, `PLAYWRIGHT_NODEJS_PATH` e `PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH` via `nix-build`. Não é necessário nenhum export manual.

   Se Chromium não estiver instalado (primeira vez):
   ```
   npx --yes playwright install chromium
   ```

4. Primeira execução: ~5-15s para npx baixar cheerio+playwright no cache. Próximas execuções: instantâneas.
5. Ao terminar, reporte ao usuário:
   - Pasta de saída
   - Por URL: modo usado (cheerio/playwright), assets baixados, se detectou SPA
   - Leia o `summary.json` para os dados
   - Caminho do `index.html` de cada URL
6. Sugira rodar `/extract-ds <out-dir>/<slug> <dest-dir>` para gerar o design system.

## Exemplos

```bash
# Uma URL, output no CWD
/fetch-site https://example.com

# Várias URLs
/fetch-site https://site1.com https://site2.com

# SPA forçado + output custom
/fetch-site https://myapp.com ./meu-dir --spa

# Lista de URLs via arquivo
/fetch-site --file=urls.txt --out=./sites

# Cheerio only (nunca tenta playwright)
/fetch-site https://blog.com --no-spa
```

## Quando usar `--spa`

- O site é uma SPA e o HTML inicial vem vazio/shell
- O download sem `--spa` retornou HTML sem conteúdo significativo
- CSS é carregado dinamicamente via JS
- Já sabe que o site é JS-heavy (React, Vue, Angular sem SSR)

Na maioria dos casos, **não use nenhum flag** — o script detecta automaticamente.

## Por que `npx --yes --package=...`

- **Zero pollution**: nada é instalado no plugin nem no projeto do usuário
- **Cache global**: primeira execução baixa para `~/.npm/_npx/`, próximas reusam
- **Reproduzível**: versão pinada garante mesmo comportamento
