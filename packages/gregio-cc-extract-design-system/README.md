# gregio-cc-extract-design-system

Extrai um **design system vivo** a partir de qualquer site (ou HTML local) em uma **fonte de verdade** consumível tanto por humanos quanto por agentes LLM.

## O que é gerado

Para cada site analisado, a skill produz:

- **Página showcase** (`/design-system` no Astro ou `design-system.html` standalone) — clone do hero original + seções canônicas (Typography, Colors, Components, Layout, Motion, Icons)
- **CSS modular** em `design-system/` — `tokens.css`, `typography.css`, `layout.css`, `components.css`, `animations.css` + `index.css` com `@import`
- **Componentes reutilizáveis** — `.astro` em `components/ds/` (modo Astro) ou snippets HTML em `assets/snippets/` (standalone)
- **`design-system.manifest.json`** — inventário machine-readable: tokens, componentes, variantes, classes, source file, exemplos
- **`DESIGN_SYSTEM.md`** — guia em linguagem natural para agentes/devs: quando usar cada componente, regras de composição, como estender

## Comandos

### `/extract-ds <url-or-path> [dest] [--spa]`

Fluxo completo: baixa o site (se URL), detecta stack do destino (Astro ou não), gera o DS adaptado.

Exemplos:
```
/extract-ds https://vivicupcakes.com.br ./my-project
/extract-ds /tmp/ds-source-123 ./my-project
/extract-ds https://complex-spa.com ./my-project --spa
```

### `/fetch-site <url> [out] [--spa]`

Só o download isolado (útil quando você quer analisar manualmente antes de gerar o DS).

## Arquitetura

```
.
├── .claude-plugin/plugin.json
├── commands/
│   ├── extract-ds.md       # comando principal
│   └── fetch-site.md       # download isolado
├── scripts/
│   ├── fetch-site.js       # fetch+cheerio (default) / Playwright (--spa)
│   ├── detect-stack.js     # detecta Astro, Tailwind, pkg manager
│   └── package.json
├── templates/
│   ├── astro/              # para projetos Astro
│   │   ├── pages/design-system.astro.tmpl
│   │   ├── components/ds/  # Button, Card, Badge, Input, Modal, Nav, Hero
│   │   └── styles/design-system/  # 6 arquivos CSS modulares
│   ├── standalone/         # para sites sem framework
│   │   ├── design-system.html.tmpl
│   │   └── assets/{css,js,snippets}
│   └── shared/
│       ├── design-system.manifest.json.tmpl
│       └── DESIGN_SYSTEM.md.tmpl
└── extract-design-system.md  # regras técnicas (referência)
```

## Por que duas saídas (Astro vs standalone)?

- **Destino com Astro detectado**: gera páginas `.astro`, componentes tipados e CSS modular que se integra ao build existente. Mais reuso, melhor DX.
- **Destino sem Astro**: gera HTML + CSS + JS puros (sem build step). Ainda assim modularizado — `assets/css/*.css` com `@import` em `index.css`.

Em ambos os modos, o **manifest JSON + DESIGN_SYSTEM.md** são idênticos — é isso que torna o DS **fonte da verdade** para agentes que precisam criar novas páginas/seções sem reinventar estilos.

## Requisitos

- **Node ≥ 20** (fetch nativo)
- **`npm`/`npx`** — usado para resolver deps on-demand via cache
- **Nada precisa ser instalado no plugin ou no projeto alvo**. As dependências (`cheerio`, `playwright`) são resolvidas no cache global do npx (`~/.npm/_npx/`) na primeira execução.

### Como os scripts rodam

```bash
# fetch básico
npx --yes --package=cheerio@^1 -- node $PLUGIN_ROOT/scripts/fetch-site.js <url> <out>

# fetch SPA (Playwright)
npx --yes --package=cheerio@^1 --package=playwright@^1.48 -- \
  node $PLUGIN_ROOT/scripts/fetch-site.js <url> <out> --spa

# detect-stack é zero-dep, roda direto
node $PLUGIN_ROOT/scripts/detect-stack.js <dir>
```

Primeira execução: ~5-15s para npx popular o cache. Próximas: instantâneas.

## Instalação (via Claude Code plugin manager)

```
/plugin install gregio-cc-extract-design-system
```

## Licença

MIT
