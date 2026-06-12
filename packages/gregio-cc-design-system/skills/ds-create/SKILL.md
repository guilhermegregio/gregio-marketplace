---
name: ds-create
description: "Full design-system pipeline from a URL: crawl the site into an offline cache, brainstorm requirements into a spec, analyze with five specialized parallel agents, build the DS as an Astro app in apps/<name>, and review it covering gaps. Supports white-label: --ref=<ds-app> takes the component inventory/API from an existing reference DS (e.g. apps/ds-nxt) while the visuals come from the crawled site. Use this skill whenever the user wants a design system created from a website — 'criar design system do site X', 'create a DS from this URL', 'clonar o visual desse site', 'extrair o design system de', 'novo DS a partir de', 'monte um design system para meu app baseado em', 'DS white label do site X com os componentes do ds-Y' — or pastes a URL asking for a design system, tokens, or a component library, even without naming the skill. Also use it to resume a partially completed pipeline (existing workspace in ~/.ds-cache) or to start a parallel independent run from the same site under a new app name."
argument-hint: <url> [app-name] [--ref=<ds-app-dir>] [--react] [--max-pages=N] [--max-depth=N] [--click=<selector>] [--skip-brainstorm] [--force]
---

## Your task

Com base nos argumentos abaixo:

<arguments>
$ARGUMENTS
</arguments>

Você é o **orquestrador** do pipeline de design system:

```
extract → brainstorm → analyze → build → review
```

Cada fase tem um procedimento canônico em
`${CLAUDE_PLUGIN_ROOT}/references/pipeline/<fase>.md` — siga-os em ordem, na
mesma conversa. Leia o doc de cada fase ao chegar nela (não todos de uma vez).

## Resolução de estado (antes de tudo)

1. Resolva os três paths da run:
   - `cacheDir = ~/.ds-cache/<site-slug>` (cache GLOBAL na home; slug = host sem
     www, ex.: `cury-net`)
   - `appName` (default: `ds-<site>`, ex.: `ds-cury`) e `appDir = apps/<appName>`
   - `workspace = <cacheDir>/apps/<appName>` — o estado desta run
2. Detecte o que já existe e **pule fases com artefato pronto** (o pipeline é
   retomável; cada artefato é caro). Olhe SOMENTE o workspace desta run:
   - `<cacheDir>/crawl.json` com status `complete` → extract feito (o crawler
     re-crawla sozinho se as flags pedirem mais — apenas repasse-as)
   - `<workspace>/ds-spec.md` com `status: approved` → brainstorm feito
   - `<workspace>/analysis/consolidated.json` → analyze feito
   - `<appDir>/design-system.manifest.json` → build feito
3. Reporte ao usuário o que vai reusar e o que vai executar. `--force` re-roda
   tudo do zero (repasse aos scripts onde aplicável).

## Isolamento (regra de escopo)

O escopo da run é exatamente **{url, app-name, --ref}**. Workspaces de outros
apps no mesmo cache, outros `apps/*` do projeto e seus showcases/manifests são
**invisíveis** para esta run — criar DSs em paralelo do mesmo site para comparar
soluções é caso de uso suportado, e olhar o vizinho contamina o resultado. Um
app-name novo = run nova do zero (mesmo que exista um DS "parecido" do mesmo
site). Exceções únicas: o DS de `--ref` (contrato de API) e o scan de
`apps/*/package.json` para achar porta livre no build.

## Execução

- **extract**: `references/pipeline/extract.md` (repasse TODAS as flags de crawl:
  `--max-pages`/`--max-depth`/`--click`/... — se o cache existir com opções mais
  estreitas, o crawler re-crawla automaticamente e reporta `recrawled: true`).
  Sites com gate (região/idade/cookies) precisam de `--click=<seletor>` para
  capturar o conteúdo real — avalie o screenshot da home; se todas as páginas
  mostram a mesma tela de gate, descubra o seletor no HTML e re-extraia.
- **brainstorm**: `references/pipeline/brainstorm.md`. Com `--skip-brainstorm`,
  aplique o baseline (`references/ds-minimum-baseline.md`) sem entrevista e
  marque o spec como approved direto. Com `--ref=<ds-app>` (white-label), o
  inventário de componentes vem do manifest do DS de referência — a entrevista
  encolhe para fidelidade visual/motion/extras.
- **analyze**: `references/pipeline/analyze.md` (5 agentes em paralelo)
- **build**: `references/pipeline/build.md` (waves de ds-builder; `--react`
  liga os exports)
- **review**: `references/pipeline/review.md`

Entre fases, um parágrafo de progresso basta — guarde o relatório completo para
o final.

## Relatório final

1. Paths: cache, spec, análise, app
2. Componentes: extracted × designed (e quais)
3. Resultado do review (fixed/pending) + status de manifest e build
4. Como abrir: `pnpm exec nx dev <nome>` → `http://localhost:<porta>/design-system`
5. Fases re-executáveis individualmente: `/ds-extract`, `/ds-brainstorm`,
   `/ds-analyze`, `/ds-build`, `/ds-review`
