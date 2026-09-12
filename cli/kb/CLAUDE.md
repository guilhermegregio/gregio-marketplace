# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão geral

`knowledge-gregio` tem **dois papéis co-iguais**: (a) **engine `kb`** da base de
conhecimento pessoal (ingestão, roteamento, grafo central e ciclo de planos sobre os
vaults Obsidian) — hoje é a ferramenta de uso diário, em `bin/kb.js` + `src/kb/`;
(b) **arquivador de Discord** (uma fonte de ingestão, descrita abaixo). A doc detalhada
do engine vive na **skill `kb`** (marketplace) e no vault; este arquivo só resume.

**Arquivador de Discord** em duas etapas: (1) **pull** baixa mensagens + anexos de
canais/threads/forums de um guild numa janela de horas (default 24h); (2)
**consolidate** lê os JSONs do dia e gera um relatório markdown estruturado via
`claude --print` (Claude Code CLI, não API).

Docs, specs e contratos **não vivem neste repo** — moram no vault pessoal, em
`vault-pessoal/10-projects/agentic-os/` (spec do arquivador, setup do bot, doc do
engine `kb`, `behaviors/*.feature`). Plano da base de conhecimento:
`~/.claude/plans/happy-churning-reef.md`.

**Regra de fronteira:** repo = código + runtime (`CLAUDE.md`, `references/` de skills,
`graphify-out/` só-código); **vault = conhecimento, e contrato é conhecimento** — os
Gherkin moram na casa do projeto no vault, nunca no repo.

## Engine kb (base de conhecimento)

O CLI `kb` (comando global; `node bin/kb.js` aqui) é a **única** coisa que muta os
vaults e constrói os grafos. Detalhe operacional e protocolo de leitura cirúrgica: skill
`kb`; ciclo de planos: skill `devflow`. Não duplicar aqui — este é só o mapa.

```bash
# Autoria / consulta
kb add <url> --vault <n> [--as <cat>]   # ingest roteado de URL
kb capture "<texto>" --vault <n>        # append no inbox
kb new --vault <n> --type <t> --title   # nova nota (frontmatter do contrato)

# Registro (repos → grafo central)
kb project add <path> [--group g] [--vault v]   # registra repo (auto-detecta monorepo) + hygiene + hook; --vault fixa o vault da casa
kb project list | scan <n> | remove <n>
kb project link-claude <n> | --all      # materializa o cross-link repo↔vault no CLAUDE.md
kb project move <n> --to-vault <v> [--from-vault v] [--dry-run] [--no-link]   # migra a casa entre vaults
kb vault index [--vault v] [--dry-run]  # regenera "## Lista" de 10-projects e "## Ativos" de 30-plans pelo frontmatter
kb group new <n> | add <g> <m...> | list # produtos lógicos (agregam repos/subprojetos)

# Grafo central (privado, local, via MCP stdio)
kb graph build [--group g]              # freshen por fonte + merge no central
kb graph serve                          # sobe o MCP (interp Python absoluto)

# Ciclo de planos cross-project (skill devflow) — fluxo v2:
#   spec → protótipo ⛔ → behaviors ⛔🧊 → código → review → finish
kb dev start <slug> --vault <n> --project <p> [--ui] [--no-contract]   # --ui scaffolda a task-gate TP; garante a casa <vault>/10-projects/<p>/behaviors/
kb dev check <slug> [--task Txx]        # valida DAG / gates / drift de contrato
kb dev freeze <slug>                    # 🧊 congela os contracts: do plano (behaviors .feature no vault)
kb dev unfreeze <slug> --reason "..."   # descongela (decisão de produto, com rastro)
kb dev run <slug>                       # computa ondas; avisa se o repo está na main
kb dev done <slug> [--promote ...]      # promove learnings/ADRs → arquiva plano → re-merge

# Harness (bootstrap e guardrails do ambiente)
kb scaffold [--profiles a,b] [--dry-run] [--list]   # prepara a estação: dirs do workspace + blocos do ~/.claude/CLAUDE.md
kb doctor                               # ✓/✗ do conjunto (exit 1 se houver ✗)
kb status [dir] [--all]                 # trabalho não salvo nos repos (exit 1 se houver risco)
kb map [dir]                            # repos git de ~/code fora do kb + cobertura repo → kb → vault (exit 1 se ✗)
kb rules <repo> [--stack a,b] [--dry-run] [--prune] [--list]   # rules do gregio-cc-rules
kb guard                                # hook PreToolUse (stdin JSON → stdout JSON)
```

`kb doctor` valida **o harness**, não a estação de quem mantém: config, plugins, hook do
guard, graphify, rules resolvíveis (mesma cadeia do `kb rules`, importada de
`commands/rules.js` — nunca duplicada), ferramentas do contrato, workspace e drift dos
blocos. Check que é da máquina de alguém (repo de config do sistema, symlink farm,
serviço local) vai em **`doctor.checks`** na config do usuário — tipos `path`,
`symlink-inside` e `command`, com `label`/`fix` obrigatórios, `platforms` e `skip_if`.
Config malformada vira ✗ do próprio bloco, nunca derruba o relatório. Doc do consumidor:
`cli/kb/README.md` e `packages/gregio-cc-harness/README.md`.

Arquitetura do engine: `src/kb/` (`config.js`, `routing.js`, `frontmatter.js`,
`graphify.js` = chokepoint do scan-root, `repo-hygiene.js`, `repo-claudemd.js`,
`freeze.js` = índice de contratos congelados, `contracts.js` = resolução de `contracts:`,
`project-move.js` = `kb project move`, `vault-index.js` = índices derivados do vault,
`repo-status.js` = varredura de trabalho
não salvo, `claude-home.js` = blocos gerenciados do `~/.claude/CLAUDE.md`, `commands/`).
Config no XDG (`~/.config/kb/config.json`, **não** neste repo); estado em
`~/.local/state/kb/`.

Os blocos do CLAUDE.md global moram em `templates/claude-home/` (um `.md` por bloco, com
frontmatter `block`/`profiles`/`order`/`version`) e viajam no pacote como o
`vault-skeleton`. Quem decide o que muda é `src/kb/claude-home.js` — `readTemplates` +
`planChanges`, **pura** (string entra, string sai) — e ela é compartilhada por
`kb scaffold` (aplica) e `kb doctor` (detecta drift, read-only): doctor que discordasse
do scaffold mandaria o humano rodar um comando que não muda nada.

### Contratos (behaviors no vault)

O contrato Gherkin mora na **casa do projeto no vault do plano**:
`<vault>/10-projects/<projeto>/behaviors/<escopo>.feature` — um arquivo por app em
monorepo. Motivo: contrato é conhecimento, não runtime; no vault ele tem path único (não
se duplica por worktree) e herda a visibilidade do vault. A resolução das entradas de
`contracts:` do `_plan.md` tem dono único, `src/kb/contracts.js` (importada por
`dev freeze`/`unfreeze`, `dev start` e `freeze.js`):

| entrada em `contracts:` | resolve para |
|---|---|
| absoluta ou `~/…` | como está |
| relativa (`agentic-os/behaviors/kb-cli.feature`) | `<vault do plano>/10-projects/<entrada>` |
| relativa ausente no vault, presente no repo de um `projects:` | o repo (**legado**) + aviso no stderr com o destino |
| ausente em todo lugar | erro listando os paths tentados |

`kb dev start --project <p>` (sem `--no-contract`) garante `behaviors/` na casa e cria
o `_project.md` se faltar — contrato sem casa vira arquivo órfão que nenhum índice
enxerga. O freeze indexa o path absoluto resolvido; o `kb guard` bloqueia edição desse
arquivo (contrato legado no repo também casa pela identidade git, e a mensagem de deny
aponta o destino no vault).

### Casa do projeto e cobertura

- `kb map` tem duas seções: **não registrados** (repos git de `~/code` fora do kb —
  não é ✗, ficar fora é escolha) e **cobertura** por projeto registrado: path vivo,
  `vault:` da config é vault registrado, casa existe (com `_project.md`) no vault
  resolvido, casa em vários vaults sem `vault:` na config, ponteiro `kb:link` do
  CLAUDE.md apontando para a casa, e cada vault com `10-projects/_index.md` listando
  todas as casas. Exit 1 se houver ✗; cada ✗ sai com o comando de correção. Só sugere,
  nunca executa.
- `kb project add --vault <v>` grava `vault` no projeto (validado antes de qualquer
  escrita — nome errado faria o `link-claude` cair no fallback em silêncio).
- `kb project move <n> --to-vault <v>` migra `10-projects/<pasta>/` inteira (behaviors
  incluso): `id`/`visibility` das notas, `vault` na config, índice de contratos
  congelados, ponteiro do CLAUDE.md (pule com `--no-link`) e índices dos dois vaults.
  Planos **não** se movem (avisa quantos ativos citam o projeto). Tudo que pode falhar é
  checado antes da primeira escrita; `--dry-run` só relata; commit fica com o humano.
- `kb vault index [--vault v] [--dry-run]` regenera as seções derivadas (`## Lista` de
  `10-projects/_index.md`, `## Ativos` de `30-plans/_index.md`) pelo frontmatter.
  Idempotente; sem `--vault`, todos.

`kb guard` é o guardrail no Claude Code (subcomando, não script solto): **bloqueia**
edição de contrato congelado e **avisa** ao escrever na main de repo com plano ativo.
Instala-se como hook `PreToolUse` com `"command": "kb guard"` — qualquer exceção nele
libera a chamada, um guardrail quebrado não pode travar o trabalho. Contratos e doc do
consumidor: `packages/gregio-cc-harness/`.

## Comandos (arquivador de Discord)

```bash
pnpm run pull                      # baixa últimas PULL_WINDOW_HOURS e grava archive/raw/{hoje}/
pnpm run consolidate               # consolida hoje -> archive/daily/{hoje}.md
pnpm run consolidate 2026-04-30    # consolida data específica (precisa do raw já existir)
pnpm run daily                     # pull + consolidate
```

Sem `pnpm install` — projeto usa **zero dependências externas**, só Node nativo. Requer Node ≥ 20.6 (precisa de `--env-file=.env`, usado em todos os scripts). Não há lint, testes nem build.

## Arquitetura

Dois entry points independentes, ligados apenas pelo diretório `archive/raw/{date}/`:

- **`src/index.js`** orquestra o pull. Usa `discoverAllSources()` (canais texto/announcement + forum + threads ativas e arquivadas dedupadas) → `fetchMessagesSince()` por fonte → `downloadAttachments()` inline → grava um JSON por canal/thread + `_summary.json`.
- **`src/consolidate.js`** lê todos os JSONs do dia, monta um transcript formatado em BRT (`[timestamp] author: content [anexos: ...]`), monta um system prompt com o esqueleto do relatório, e faz `spawn('claude', ['--print'])` enviando o prompt via stdin. Saída do CLI vira `archive/daily/{date}.md`.

Camada Discord (`src/discord/`):
- `client.js` — fila serial global de fetch com throttle de 200ms; ao receber 429 lê `retry_after` e retenta recursivamente.
- `channels.js` — descoberta + dedupe de threads ativas/arquivadas; filtra threads cujo parent foi excluído; `isForumLike()` marca os tipos 15/16 (containers que **não** têm mensagens diretas, só threads).
- `messages.js` — paginação **backward** com `before=<id>`, parando ao cruzar `since`. Usar `after` é mais frágil aqui.
- `attachments.js` — download síncrono durante o pull.
- `snowflake.js` — conversão snowflake↔timestamp em **BigInt** (operações de bit em `Number` truncam em 32 bits e quebram).

## Pegadinhas que importam

- **URLs do Discord CDN expiram em ~24h** (são assinadas com `?ex=&is=&hm=`). Por isso anexos são baixados inline no pull — não dá pra arquivar URLs e baixar depois.
- **Forum/Media channels (tipo 15/16)** não têm mensagens diretas; o pull pula o canal pai e itera só as threads (cada "post" é uma thread).
- **Consolidate depende do `claude` CLI estar no PATH e logado** — não usa `ANTHROPIC_API_KEY`. Se editar o spawn, mantenha `stdio: ['pipe', 'pipe', 'inherit']` pra logs do CLI irem ao terminal.
- **Snowflakes precisam BigInt**, sempre. Veja `src/discord/snowflake.js`.
- **`archive/` é gitignored** e contém dados privados do guild — nunca commitar amostras reais.
- O system prompt em `consolidate.js` define a estrutura fixa do relatório (TL;DR, TODOs, Decisões, Prazos, Bloqueios, Menções, Links, Resumo por Canal). Mudar seções aqui é mudar o contrato do output diário.

## Configuração

`.env` (copiar de `.env.example`): `DISCORD_BOT_TOKEN` e `DISCORD_GUILD_ID` obrigatórios. `DISCORD_USER_ID` opcional ativa substituição de `<@id>` por `@VOCÊ` no transcript e adiciona nota no system prompt. `EXCLUDE_CHANNEL_IDS` (CSV) e `PULL_WINDOW_HOURS` (default 24) também opcionais.

<!-- kb:link start -->
> 📚 **Conhecimento deste projeto mora no vault:** `vault-pessoal/10-projects/agentic-os/`
>
> Repo = código + runtime. Docs, arquitetura, ADRs, planos, learnings e research
> vivem no vault (não crie doc/plano solto aqui). Consulte/registre via skill `kb`;
> planos cross-project via `kb dev` (skill `devflow`).
<!-- kb:link end -->
