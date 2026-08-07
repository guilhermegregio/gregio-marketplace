# gregio-marketplace

Marketplace de plugins do Claude Code. Cada pacote em `packages/` é um plugin
independente (skills, commands, agents, scripts) registrado em
`.claude-plugin/marketplace.json`. Instalação local via `/plugin` apontando para
este repo.

## Índice dos packages

| Package | CLAUDE.md | O que é |
|---|---|---|
| `gregio-cc-design-system` | [packages/gregio-cc-design-system/CLAUDE.md](packages/gregio-cc-design-system/CLAUDE.md) | Pipeline multi-agente de design systems: crawl de site → spec → análise → app Astro → review (o pacote mais complexo) |
| `gregio-cc-resources` | [packages/gregio-cc-resources/CLAUDE.md](packages/gregio-cc-resources/CLAUDE.md) | Commands de workflow (plan→task→finish), hooks de notificação Discord, MCP chrome-devtools |
| `gregio-cc-rules` | [packages/gregio-cc-rules/CLAUDE.md](packages/gregio-cc-rules/CLAUDE.md) | Rules por contexto (Next/Astro/n8n/SQL) instaláveis em qualquer repo — MVP da ponte de bootstrap do harness |
| `gregio-cc-app-maintenance` | [packages/gregio-cc-app-maintenance/CLAUDE.md](packages/gregio-cc-app-maintenance/CLAUDE.md) | Manutenção de apps Node: update de deps com validação completa + auditoria supply-chain |

Antes de mexer num pacote, leia o CLAUDE.md dele — cada um documenta os
contratos e as regras que não podem regredir.

## Registro no marketplace

`.claude-plugin/marketplace.json` lista cada plugin com `name`, `source`
(`./packages/<nome>`), `description`, `version` e `strict`. **A `version` aqui
deve ficar sincronizada com a do `plugin.json` do pacote** — bump sempre nos
dois.

## Anatomia de um plugin (convenção do repo)

```
packages/<nome>/
├── .claude-plugin/plugin.json   # name, description, version, author, license
├── README.md                    # para o consumidor: o que o plugin faz
├── CLAUDE.md                    # para quem mantém: contratos, armadilhas, testes
├── skills/<skill>/SKILL.md      # frontmatter: name, description, argument-hint
├── commands/*.md                # slash commands simples (alternativa leve a skills)
├── agents/*.md                  # subagents (frontmatter: name, description, tools, model)
├── scripts/*.js                 # Node ESM ≥20; deps via npx on-demand, nada instalado
├── references/*.md              # docs carregados sob demanda pelas skills
├── templates/*.tmpl             # marcadores {{VALUE:...}} e {{INSTRUCTION:...}}
└── evals/evals.json             # prompts + assertions p/ o loop do skill-creator
```

Nem todo plugin precisa de tudo — `resources` só tem commands/hooks/scripts.

## Boas práticas de skills (validadas com o skill-creator neste repo)

**Sempre crie/edite skills invocando a skill `skill-creator`** (em vez de
escrever o SKILL.md "na mão"): ela carrega as práticas oficiais mais recentes —
se o skill-creator for atualizado, herdamos as novidades automaticamente — e o
loop dela (draft → test com/sem skill → eval-viewer → iterar → otimizar
description) é como as skills deste repo foram calibradas. As práticas abaixo
são o que já validamos aqui e **complementam** o skill-creator, não o
substituem.

1. **Description é o mecanismo de triggering.** Modelos under-trigger skills:
   escreva descriptions "pushy" com frases-gatilho em PT **e** EN, incluindo
   gatilhos indiretos (usuário cola uma URL e pede o resultado sem nomear a
   skill). Otimize com o loop de descriptions do skill-creator quando a skill
   estabilizar.
2. **Progressive disclosure.** SKILL.md fino (< ~100 linhas): parsing de args +
   resumo do contrato + ponteiro para `references/`. O procedimento detalhado
   vive nos references; references > 300 linhas ganham sumário no topo.
   Regra DRY: comportamento compartilhado entre skills vai num reference, nunca
   duplicado em dois SKILL.md.
3. **Imperativo explicando o porquê.** Em vez de MUSTs rígidos, diga a razão da
   regra — o modelo generaliza melhor ("classes exatas preservam a fidelidade
   do clone" > "NUNCA renomeie classes").
4. **Scripts via `${CLAUDE_PLUGIN_ROOT}` literal** (o Claude Code substitui em
   runtime — nunca descobrir o path com ls). Execução com dependência pinada:
   `npx --yes --package=<dep>@<versão> -- node "${CLAUDE_PLUGIN_ROOT}/scripts/x.js"`.
5. **Multi-agente**: defina os agentes em `agents/` (reuso entre skills,
   restrição de `tools`, `model` próprio); o SKILL.md/pipeline doc instrui o
   dispatch com prompt mínimo (só paths de input/output) — o método/persona
   vive no arquivo do agente. Agentes escrevem resultados em arquivos e
   retornam só um sumário curto.
6. **Evals**: saídas objetivamente verificáveis ganham assertions em
   `evals/evals.json` (checáveis por script); qualidade visual/subjetiva fica
   para revisão humana via eval-viewer do skill-creator.

## Checklist: criar um plugin novo

1. `packages/gregio-cc-<nome>/` com `.claude-plugin/plugin.json` (version 0.1.0)
2. Registrar em `.claude-plugin/marketplace.json` (mesma version)
3. Skills criadas **via skill-creator** (ver seção acima) seguindo as práticas
   do repo; scripts ESM com deps via npx pinado
4. `README.md` (consumidor) + `CLAUDE.md` (mantenedor) + `evals/evals.json`
5. Testar instalado de verdade: `/plugin` → instalar deste repo → invocar a
   skill num projeto real (não só ler os arquivos)
6. Commit com escopo: `feat(<nome-curto>): ...`

## Ambiente do mantenedor

- **NixOS 26.05**: `/etc/NIXOS` não existe mais — detecção de NixOS é
  `/run/current-system`. Playwright resolve o Chromium via
  `nix-build "<nixpkgs>" -A playwright-driver.browsers` (ver `setupNixEnv` no
  design-system). Binários hardcoded de Nix store em configs (ex.: mcp.json do
  resources) quebram após GC — preferir resolução dinâmica.
- Preferências de CLI do usuário: `rg` (nunca grep), `fd` (nunca find), `jq`,
  `httpie` (nunca curl). Node ≥ 20, pnpm.
- **Consumidor real dos DSs**: `~/code/ds-agent` (monorepo Nx/pnpm, apps Astro
  em `apps/ds-*`) — é onde os testes e2e do design-system rodam.

<!-- kb:link start -->
> 📚 **Conhecimento deste projeto mora no vault:** `vault-pessoal/10-projects/gregio-marketplace/`
>
> Repo = código + runtime. Docs, arquitetura, ADRs, planos, learnings e research
> vivem no vault (não crie doc/plano solto aqui). Consulte/registre via skill `kb`;
> planos cross-project via `kb dev` (skill `devflow`).
<!-- kb:link end -->
