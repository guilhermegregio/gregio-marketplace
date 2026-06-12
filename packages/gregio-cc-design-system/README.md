# gregio-cc-design-system

Pipeline de design systems para Claude Code: extrai um site inteiro com
Playwright para um cache offline reutilizável, levanta requisitos num spec,
analisa a extração com agentes especializados em paralelo, constrói o DS como
um app Astro em `apps/<nome>` e revisa cobrindo gaps.

```
extract → brainstorm → analyze → build → review
```

## Skills

| Command | Fase | Description |
|---------|------|-------------|
| `/ds-create <url> [app-name]` | todas | Orquestrador: pipeline completo a partir de uma URL (retomável — pula fases com artefato pronto) |
| `/ds-extract <url>` | 1 | Crawl multi-página (Playwright) → `.ds-cache/<site>/` com HTML pós-JS, assets, screenshots desktop+mobile e estilos computados |
| `/ds-brainstorm <cache-dir>` | 2 | Entrevista de requisitos → `ds-spec.md` (com baseline próprio de "DS mínimo" quando o usuário não sabe o que precisa) |
| `/ds-analyze <cache-dir>` | 3 | 5 agentes paralelos (tokens, tipografia, componentes, motion, layout) → `analysis/consolidated.json` + `gaps.md` |
| `/ds-build <cache-dir> <app-dir>` | 4 | Scaffold Astro (padrão ds-agent/Nx) + tasks executadas por agentes `ds-builder` em waves paralelas |
| `/ds-review <app-dir> [cache-dir]` | 5 | Agente revisor final: cobertura do spec, disciplina de tokens, a11y, showcase, build — corrige gaps pequenos |

## Agentes

`ds-token-analyst`, `ds-typography-analyst`, `ds-component-analyst`,
`ds-motion-analyst`, `ds-layout-analyst` (análise, read-only + outputs),
`ds-builder` (executa uma task de build), `ds-reviewer` (revisão final).

## O que é gerado

App Astro independente em `apps/ds-<nome>` (porta própria, `project.json` se o
repo usa Nx):

- `src/styles/design-system/` — `tokens.css`, `typography.css`, `layout.css`,
  `components/<grupo>.css`, `animations.css`
- `src/components/ds/*.astro` — componentes com props tipadas
- `src/pages/design-system.astro` — showcase vivo (hero clonado do original)
- `design-system.manifest.json` — fonte da verdade machine-readable; cada
  componente tem `provenance: extracted | designed`
- `DESIGN_SYSTEM.md` — guia humano/agente
- `ds-exports/` (com `--react`) — `tokens.ts` + wrappers React

## Conceitos

- **Cache offline global** (`~/.ds-cache/<site>/`): a extração é feita uma vez e
  compartilhada entre projetos; todas as análises e rebuilds funcionam sem rede.
  Se as flags pedirem mais que o cache tem (`--max-depth` maior, `--click`
  novo...), o crawler **re-crawla automaticamente**. Contrato em
  `references/cache-layout.md`.
- **Workspace por app** (`~/.ds-cache/<site>/apps/<nome>/`): spec + análise de
  cada DS alvo, isolados — dá para criar DSs diferentes do mesmo site em
  paralelo (ex.: `ds-cury` e `ds-cury-test`) sem uma run enxergar a outra.
  Re-crawls preservam os workspaces.
- **Gates**: sites com seleção de região/idade/cookies cobrindo o conteúdo são
  atravessados com `--click=<seletor>` (cookie persiste no crawl inteiro).
- **Spec** (`ds-spec.md`): o que o DS precisa ter para o app alvo. O que o site
  não tem vira gap e é **desenhado** coerente com a estética extraída.
- **Provenance**: `extracted` = fiel ao site (classes/markup/timings exatos);
  `designed` = criado para preencher o spec.
- **White-label** (`--ref=apps/ds-X`): o inventário e a API de componentes vêm
  de um DS de referência existente (ex.: `apps/ds-nxt`); o visual vem do site
  extraído. As Props dos componentes são contrato — o app consumidor troca de
  DS sem mudar uma linha.

## Architecture

```
gregio-cc-design-system/
├── skills/          6 SKILL.md finos (1 orquestrador + 5 fases)
├── agents/          7 agentes (5 analistas, builder, reviewer)
├── references/      pipeline/<fase>.md + guias on-demand
├── templates/       astro-app/ (scaffold), shared/ (spec, task, manifest), react/
└── scripts/         crawl-site.js, validate-manifest.js (deps via npx)
```

## Requisitos

- Node ≥ 20 (deps via `npx --yes --package=playwright@1.58.2`, nada instalado
  permanentemente)
- NixOS suportado out-of-the-box (resolve o Chromium via nix automaticamente);
  em outros sistemas, `npx --yes playwright install chromium` na primeira vez
