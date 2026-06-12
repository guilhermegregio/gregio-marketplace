# Fase 1 — Extract (crawl do site para cache offline)

Objetivo: baixar o site inteiro (páginas, assets, screenshots, estilos computados)
para `.ds-cache/<site-slug>/` uma única vez. Todas as fases seguintes trabalham
offline sobre esse cache — extrair bem aqui evita re-fetch e retrabalho depois.

## Procedimento

1. Resolva o diretório de saída: default `./.ds-cache` no projeto atual (o crawler
   cria `<out>/<site-slug>/` sozinho; não crie diretórios manualmente).

2. Execute o crawler (referencie scripts sempre via `${CLAUDE_PLUGIN_ROOT}` literal —
   o Claude Code substitui em runtime; não tente descobrir o path):

   ```bash
   npx --yes --package=playwright@1.58.2 -- node "${CLAUDE_PLUGIN_ROOT}/scripts/crawl-site.js" <url> [flags]
   ```

   Flags úteis (defaults entre parênteses): `--out=<dir>` (./.ds-cache),
   `--max-pages=<n>` (10), `--max-depth=<n>` (2), `--include=<re>`, `--exclude=<re>`,
   `--max-assets=<n>` (1500), `--max-img=<n>` (400), `--no-mobile`, `--sections`,
   `--click=<selector>` (repetível), `--click-wait=<ms>` (1500), `--force`.

   **Gates (região/idade/consentimento)**: sites como cury.net cobrem TODAS as
   páginas com um gate até o usuário escolher (ex.: SP/RJ) — sem tratar isso, o
   cache inteiro vira screenshots do gate. Use `--click` com o seletor do botão
   do gate (ex.: `--click='#adopt-accept-all-button' --click='[data-change-state="SP"]'`).
   O clique acontece no primeiro match visível de cada página, o cookie
   resultante persiste no crawl inteiro (context compartilhado) e navegações
   disparadas pelo clique são aguardadas.

   - **NixOS**: o script detecta `/etc/NIXOS` e resolve o Chromium via nix
     automaticamente — nenhum export manual.
   - Em outros sistemas, se o Chromium não estiver instalado (primeira vez):
     `npx --yes playwright install chromium`.
   - O crawl é sequencial e pode levar alguns minutos — qualidade importa mais
     que velocidade aqui. Não interrompa por demora; se interrompido, re-rodar
     **retoma** de onde parou (cache `partial`).

3. O script imprime na última linha um JSON: `{cached, cacheDir, status, totals}`.
   - `cached: true` → o cache já existia completo e nada foi baixado. Só use
     `--force` se o usuário pedir dados frescos ou se os limites pedidos forem
     maiores que os do cache (o script avisa nesse caso).

4. Leia `<cacheDir>/crawl.json` e reporte ao usuário:
   - Páginas baixadas (url → slug, status, erros se houver)
   - Total de assets e bytes
   - Páginas que ficaram na fila (`queue`) — sugira `--max-pages` maior se algo
     importante ficou de fora (julgue pelos pathnames)

5. Avalie a qualidade da extração antes de seguir adiante:
   - Abra 1–2 `pages/*/computed.json`: `rootVars` e `samples` vieram populados?
     Se vazios, o site pode ter bloqueado o crawler — verifique o HTML salvo.
   - Confira que `screenshots/desktop.png` existe nas páginas principais.

6. Próximo passo: fase brainstorm (`references/pipeline/brainstorm.md`), que lê
   este cache. O contrato completo do cache está em `references/cache-layout.md`.
