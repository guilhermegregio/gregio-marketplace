# Fase 5 — Review (revisor final cobrindo gaps)

Objetivo: revisão independente do app gerado por um agente `ds-reviewer`, que
verifica cobertura do spec, disciplina de tokens, a11y, showcase e build — e
corrige diretamente o que for pequeno. O build foi feito por agentes paralelos
por task; o reviewer existe para achar o que escapou **entre** as tasks.

## Procedimento

1. Pré-requisitos: app construído (`apps/<nome>` com manifest) e, idealmente, o
   cache com spec/análise. Sem o cache a revisão ainda vale (itens 2–6 do
   checklist do agente), mas a cobertura de spec fica limitada — avise.

2. Dispare **um** agente `ds-reviewer` (Agent tool) com prompt mínimo:

   ```
   appDir: <path absoluto de apps/<nome>>
   cacheDir: <path absoluto do cache, se houver>
   spec: <cacheDir>/apps/<app-name>/ds-spec.md
   analysis: <cacheDir>/apps/<app-name>/analysis/
   validator: ${CLAUDE_PLUGIN_ROOT}/scripts/validate-manifest.js
   ```

   O método e o checklist vivem no próprio agente. Ele escreve
   `apps/<nome>/specs/ds-build/review.md` e corrige gaps pequenos diretamente.

3. Quando o reviewer retornar, **confirme você mesmo** (não confie no relato):
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-manifest.js" apps/<nome>/design-system.manifest.json`
   - `pnpm exec nx build <nome>` (ou `pnpm --dir apps/<nome> build`)

4. Reporte ao usuário:
   - Findings: quantos `fixed`, quantos `pending` (estes com o que falta decidir)
   - Status final de manifest e build
   - Como abrir o showcase: `pnpm exec nx dev <nome>` → `http://localhost:<porta>/design-system`
   - Se houver `pending` de design (componente faltando), ofereça executar como
     uma rodada extra de build tasks

## Isolamento (regra de escopo)

O escopo desta fase é o workspace `<cacheDir>/apps/<app-name>/` + o crawl do
site. **Não leia** specs, análises ou apps de outros workspaces/DSs — runs
paralelas do mesmo site (ex.: ds-cury e ds-cury-test) existem justamente para
comparar soluções independentes, e olhar o vizinho contamina o resultado.
Exceções únicas: o DS de referência indicado em `components_ref` (contrato de
API) e, no build, o scan de `apps/*/package.json` só para achar porta livre.
