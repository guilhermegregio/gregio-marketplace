---
name: ds-create
description: "Full design-system pipeline from a URL: crawl the site into an offline cache, brainstorm requirements into a spec, analyze with five specialized parallel agents, build the DS as an Astro app in apps/<name>, and review it covering gaps. Use this skill whenever the user wants a design system created from a website — 'criar design system do site X', 'create a DS from this URL', 'clonar o visual desse site', 'extrair o design system de', 'novo DS a partir de', 'monte um design system para meu app baseado em' — or pastes a URL asking for a design system, tokens, or a component library, even without naming the skill. Also use it to resume a partially completed pipeline (existing .ds-cache)."
argument-hint: <url> [app-name] [--react] [--max-pages=N] [--max-depth=N] [--skip-brainstorm] [--force]
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

1. `cacheDir = .ds-cache/<site-slug>` (o slug é o host sem www, ex.: `cury-net`)
   e `appDir = apps/<app-name>` (default: `ds-<site>`, ex.: `ds-cury`).
2. Detecte o que já existe e **pule fases com artefato pronto** (o pipeline é
   retomável; cada artefato é caro):
   - `crawl.json` com status `complete` → extract feito
   - `ds-spec.md` com `status: approved` → brainstorm feito
   - `analysis/consolidated.json` → analyze feito
   - `appDir` com `design-system.manifest.json` → build feito
3. Reporte ao usuário o que vai reusar e o que vai executar. `--force` re-roda
   tudo do zero (repasse aos scripts onde aplicável).

## Execução

- **extract**: `references/pipeline/extract.md` (repasse `--max-pages`/`--max-depth`)
- **brainstorm**: `references/pipeline/brainstorm.md`. Com `--skip-brainstorm`,
  aplique o baseline (`references/ds-minimum-baseline.md`) sem entrevista e
  marque o spec como approved direto.
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
