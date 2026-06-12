# Fase 2 — Brainstorm (requisitos → ds-spec.md)

Objetivo: transformar a intenção do usuário num documento de requisitos
(`<cache>/ds-spec.md`) que guia a análise e o build. O spec é o que permite criar
um DS **completo para o app alvo** mesmo quando o site fonte não tem tudo — o que
faltar vira gap a ser desenhado, não buraco no DS.

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

4. **Escreva o spec** em `<cache>/ds-spec.md` usando
   `${CLAUDE_PLUGIN_ROOT}/templates/shared/ds-spec.md.tmpl` (preencha os marcadores
   `{{VALUE:...}}` e `{{INSTRUCTION:...}}` — nenhum marcador pode sobrar no arquivo
   final). Pontos de atenção:
   - O frontmatter é o **estado do pipeline**: `cache_dir`, `app_dir`,
     `react_exports` e `status` são lidos pelas fases seguintes.
   - Na tabela de componentes, marque a "origem esperada" (site|criar) pelo que
     você viu nos screenshots — a análise confirma depois.

5. **Peça aprovação**: mostre um resumo do spec (não o arquivo inteiro) e pergunte
   se está bom. Ajuste se necessário e então mude `status: draft` → `status: approved`
   no frontmatter. As fases seguintes só rodam com spec aprovado.
