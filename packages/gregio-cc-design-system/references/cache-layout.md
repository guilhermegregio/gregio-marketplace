# Cache de extração — contrato do diretório

Todo o pipeline (brainstorm, analyze, build, review) trabalha **offline** sobre este
cache. Depois que `crawl-site.js` termina com `status: "complete"`, nenhuma fase
seguinte deve fazer requisição de rede ao site original — se algo está faltando aqui,
o caminho certo é re-crawlar com `--force`/limites maiores, não buscar ad-hoc.

## Layout

```
.ds-cache/<site-slug>/              # site-slug = host sem www, ex: "cury-net"
├── crawl.json                      # índice do crawl (ver abaixo)
├── ds-spec.md                      # escrito pela fase brainstorm
├── analysis/                       # escrito pela fase analyze
│   ├── tokens.json / tokens.md
│   ├── typography.json / typography.md
│   ├── components.json / components.md
│   ├── motion.json / motion.md
│   ├── layout.json / layout.md
│   ├── consolidated.json           # proto-manifest consolidado
│   ├── gaps.md                     # itens do spec ausentes no site → diretrizes de design
│   └── ANALYSIS.md                 # sumário executivo
├── pages/
│   └── <page-slug>/                # "home" para a entry; senão pathname slugificado
│       ├── index.html              # DOM pós-JS, refs reescritas para ../../assets/
│       ├── page.json               # url, title, depth, headings, links {followed, ignored}
│       ├── computed.json           # ver "computed.json" abaixo
│       └── screenshots/
│           ├── desktop.png         # full-page 1440×900 (sempre)
│           ├── mobile.png          # full-page 390×844 (default; --no-mobile desliga)
│           └── section-NN-<id>.png # só com --sections, só na entry page
└── assets/                         # compartilhado entre páginas, dedup global por URL
    ├── css/ js/ img/ font/ json/ other/
    └── manifest.json               # { assets: { <url>: {kind, path, bytes, contentType, pages[]} } }
```

## crawl.json

```json
{
  "sourceUrl": "https://cury.net/",
  "siteSlug": "cury-net",
  "startedAt": "...", "finishedAt": "...",
  "status": "complete | partial",
  "options": { "maxPages": 10, "maxDepth": 2, "...": "flags usadas" },
  "pages": [
    {
      "url": "...", "finalUrl": "...", "slug": "home", "title": "...",
      "depth": 0, "status": 200, "htmlBytes": 12345,
      "screenshots": { "desktop": "screenshots/desktop.png", "mobile": "..." },
      "error": null
    }
  ],
  "queue": [ { "url": "...", "depth": 2, "nav": false } ],
  "totals": { "pages": 8, "assetsOk": 240, "bytes": 9999999, "droppedAssets": 0, "droppedImages": 0 }
}
```

- `status: "complete"` → cache utilizável; re-runs do crawler saem imediatamente
  (`cached: true` no JSON final do stdout) sem tocar na rede.
- `status: "partial"` → crawl interrompido; rodar o crawler de novo **retoma** a fila
  de onde parou (páginas já salvas não são re-baixadas).
- `queue` lista o que ficou de fora (limite de páginas atingido) — útil para decidir
  se vale re-crawlar com `--max-pages` maior.

## computed.json

Existe porque o CSS bruto de sites modernos (Tailwind, CSS-in-JS, minificação) é
ilegível para análise direta. Captura no browser, pós-render:

- `rootVars` — todas as custom properties declaradas em `:root`/`html`/`body`,
  com o **valor resolvido** (não a expressão). Fonte primária de tokens.
- `samples` — `getComputedStyle` de elementos-amostra (`body`, `h1`–`h6`, `paragraph`,
  `link`, `button`, `input`, `card`, `nav`, `footer`): fontFamily, fontSize, fontWeight,
  lineHeight, letterSpacing, color, backgroundColor, borderRadius, border, boxShadow,
  padding, gap, transition*. Cada amostra registra o elemento que casou (`element`).
- `fonts` — fontes efetivamente carregadas (`document.fonts`): family, weight, style.

## Regras de leitura para agentes

- Comece sempre por `crawl.json` para saber quais páginas existem e onde estão.
- `pages/*/computed.json` é a fonte mais confiável de tokens; o CSS em `assets/css/`
  serve para confirmar nomes de classes, keyframes e media queries.
- Screenshots são evidência visual: cite o arquivo usado ao reportar uma conclusão.
- `assets/manifest.json` mapeia cada asset às páginas que o usam (`pages[]`).
