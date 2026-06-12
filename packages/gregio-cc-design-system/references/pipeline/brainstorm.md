# Fase 2 — Brainstorm (requisitos → ds-spec.md)

Objetivo: transformar a intenção do usuário num documento de requisitos
(`<cacheDir>/apps/<app-name>/ds-spec.md` — o workspace da run) que guia a
análise e o build. `app-name` é obrigatório nesta fase: é ele que isola esta
run das demais (o ds-create passa; standalone, derive do pedido ou pergunte). O spec é o que permite criar
um DS **completo para o app alvo** mesmo quando o site fonte não tem tudo — o que
faltar vira gap a ser desenhado, não buraco no DS.

Há três fontes possíveis para o inventário de componentes, em ordem de prioridade:
1. **DS de referência** (`--ref=<app-dir>` ou o usuário citar "componentes do
   ds-X" / "para aplicar no app Y") — caso white-label, ver seção abaixo
2. **Pedido explícito do usuário** na entrevista
3. **Baseline mínimo** (`references/ds-minimum-baseline.md`)

## Procedimento

1. **Ancore no site extraído.** Leia `<cache>/crawl.json` e olhe os screenshots
   desktop das 2–3 páginas principais (Read nos .png). Isso dá contexto visual para
   conduzir a conversa com perguntas informadas ("vi que o site usa cards escuros
   com glow — quer preservar isso?").

2. **Entreviste o usuário** via AskUserQuestion (1 rodada, no máximo 2). Cubra:
   - **Objetivo**: que app/produto vai consumir o DS? (define quais componentes
     importam — um dashboard precisa de Table/Sidebar; uma landing, de Hero/CTA)
   - **Componentes**: além do tier 1 do baseline, o que o app precisa?
     (apresente o tier 2 como opções)
   - **Fidelidade**: clonar a identidade do site vs. usar como inspiração?
   - **Dark mode / motion / React exports**: sim ou não
   - Se o usuário já respondeu algo na conversa ou nos argumentos, não pergunte
     de novo — extraia.

3. **Se o usuário não sabe o que precisa** (ou pediu `--baseline`/`--skip-brainstorm`):
   aplique `${CLAUDE_PLUGIN_ROOT}/references/ds-minimum-baseline.md` inteiro como
   escopo, apresente um resumo de uma tela e siga. O baseline existe exatamente
   para esse caso — não trave o pipeline em interrogatório.

3b. **DS de referência (white-label)** — quando `--ref=<app-dir>` foi passado ou
   o usuário disse algo como "com os componentes do ds-nxt" / "para aplicar no
   app X". O objetivo: o novo DS é uma **pele** trocável — mesma API de
   componentes do DS de referência, visual do site extraído.
   - Leia `<ref>/design-system.manifest.json` (tolere variações de schema: v1
     antigo usa `components[].variants` como array de strings e pode ter
     `sharedUi`) e liste `<ref>/src/components/ds/*.astro`.
   - A tabela de componentes do spec é gerada do manifest de referência: uma
     linha por componente, com variantes/estados copiados e a coluna "API de
     referência" apontando o `.astro` correspondente. Itens de `sharedUi` com
     showcase também entram.
   - Grave `components_ref: <app-dir>` no frontmatter.
   - "Origem esperada" de cada item: chute honesto olhando os screenshots do
     site (um Button provavelmente existe; um ExerciseCard de app de treino,
     não) — a análise confirma.
   - A entrevista encolhe: com referência definida, pergunte apenas fidelidade
     visual, motion e extras — nunca re-pergunte o inventário.

4. **Escreva o spec** em `<cacheDir>/apps/<app-name>/ds-spec.md` (crie o
   workspace se não existir) usando
   `${CLAUDE_PLUGIN_ROOT}/templates/shared/ds-spec.md.tmpl` (preencha os marcadores
   `{{VALUE:...}}` e `{{INSTRUCTION:...}}` — nenhum marcador pode sobrar no arquivo
   final). Pontos de atenção:
   - O frontmatter é o **estado do pipeline**: `cache_dir` (path ABSOLUTO do
     cache, ex. `/home/<user>/.ds-cache/cury-net`), `app_dir`, `components_ref`,
     `react_exports` e `status` são lidos pelas fases seguintes.
   - Na tabela de componentes, marque a "origem esperada" (site|criar) pelo que
     você viu nos screenshots — a análise confirma depois.

5. **Peça aprovação**: mostre um resumo do spec (não o arquivo inteiro) e pergunte
   se está bom. Ajuste se necessário e então mude `status: draft` → `status: approved`
   no frontmatter. As fases seguintes só rodam com spec aprovado.

## Isolamento (regra de escopo)

O escopo desta fase é o workspace `<cacheDir>/apps/<app-name>/` + o crawl do
site. **Não leia** specs, análises ou apps de outros workspaces/DSs — runs
paralelas do mesmo site (ex.: ds-cury e ds-cury-test) existem justamente para
comparar soluções independentes, e olhar o vizinho contamina o resultado.
Exceções únicas: o DS de referência indicado em `components_ref` (contrato de
API) e, no build, o scan de `apps/*/package.json` só para achar porta livre.
