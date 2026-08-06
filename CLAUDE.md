# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão geral

`knowledge-gregio` tem dois papéis: (a) **arquivador de Discord** (descrito abaixo);
(b) **engine `kb`** da base de conhecimento pessoal (ingestão, roteamento e grafo
central sobre vaults Obsidian). O engine `kb` está em `bin/kb.js` + `src/kb/` —
veja a doc dele no vault (abaixo). O arquivador é uma fonte de ingestão futura.

**Arquivador de Discord** em duas etapas: (1) **pull** baixa mensagens + anexos de
canais/threads/forums de um guild numa janela de horas (default 24h); (2)
**consolidate** lê os JSONs do dia e gera um relatório markdown estruturado via
`claude --print` (Claude Code CLI, não API).

Docs e specs **não vivem neste repo** — moram no vault pessoal, em
`vault-pessoal/10-projects/ai-dev-harness/` (spec do arquivador, setup do bot, doc do
engine `kb`). Plano da base de conhecimento: `~/.claude/plans/happy-churning-reef.md`.

## Comandos

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
> 📚 **Conhecimento deste projeto mora no vault:** `vault-pessoal/10-projects/ai-dev-harness/`
>
> Repo = código + runtime. Docs, arquitetura, ADRs, planos, learnings e research
> vivem no vault (não crie doc/plano solto aqui). Consulte/registre via skill `kb`;
> planos cross-project via `kb dev` (skill `devflow`).
<!-- kb:link end -->
