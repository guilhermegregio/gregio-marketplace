# gregio-cc-resources — guia do mantenedor

Plugin de produtividade: 8 slash commands de workflow, hooks de notificação e
um MCP server. Sem skills — commands são markdown leves com frontmatter
`description`. Leia também o `CLAUDE.md` da raiz.

## O que existe

- **Commands de fluxo de feature** (encadeados, nesta ordem):
  `plan` (brainstorm com 3 perspectivas) → `plan-task` (estrutura tasks) →
  `next-task` (implementa a próxima + valida com `/check`) → `plan-finish`
  (consolida docs e limpa o estado). Auxiliares: `check` (lint/build com
  auto-fix), `next-task-fix`, `prime` (carrega contexto do projeto),
  `worktree` (cria/remove git worktree).
- **Hooks** (`hooks/hooks.json`): permission_prompt / idle_prompt / Stop →
  `scripts/notify.sh` (beep local + embed para webhook do Discord).
- **MCP** (`mcp.json`): chrome-devtools via `npx chrome-devtools-mcp@latest`.

## Contrato crítico: o estado em `@specs/`

O fluxo plan→task→finish guarda estado **no projeto alvo** (não no plugin):

- `specs/current.md` — plano atual
- `specs/state.json` — fila/estado das tasks
- `specs/tasks/*` — tasks individuais
- consolidação final em `specs/<nome-modulo>/README.md`; o contrato de behaviors vai
  para a casa do projeto no vault (`<vault>/10-projects/<projeto>/behaviors/<nome-modulo>.feature.md`),
  não para o repo

Refactors nos commands devem manter esses paths e formatos compatíveis:
projetos em andamento têm `specs/` no formato antigo e um `next-task` novo
precisa continuar lendo o `state.json` que o `plan-task` antigo escreveu.

## Armadilhas

- `mcp.json` aponta o Chrome por **path hardcoded do Nix store** — quebra após
  `nix-collect-garbage` ou em outra máquina. Ao tocar nesse arquivo, prefira
  resolução dinâmica (ver `setupNixEnv` do design-system como padrão); ao menos
  saiba que "MCP chrome-devtools não conecta" geralmente é isso.
- `notify.sh` contém a URL do webhook do Discord — não publicar exemplos com a
  URL real; o beep usa Node, que precisa estar no PATH do hook.

## Como testar

Instalar o plugin num projeto descartável e percorrer o ciclo completo:
`/plan` → `/plan-task` → `/next-task` → `/plan-finish`, conferindo que
`specs/` evolui como descrito acima. Hooks: disparar um Stop e verificar beep +
mensagem no Discord.

## Versionamento

Bump em `.claude-plugin/plugin.json` E na entrada do
`.claude-plugin/marketplace.json` da raiz (este pacote aparece lá como
`gregio-marketplace`).
