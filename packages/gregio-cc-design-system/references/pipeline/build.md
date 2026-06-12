# Fase 4 — Build (scaffold + tasks + builders paralelos)

Objetivo: materializar o DS como um app Astro em `apps/<nome>`, decompondo o
trabalho em tasks executadas por agentes `ds-builder` em waves paralelas. As
tasks isolam arquivos para que os builders nunca conflitem entre si.

## Pré-requisitos

- `<cache>/analysis/consolidated.json` e `gaps.md` (fase analyze)
- `<cache>/ds-spec.md` aprovado (o frontmatter traz `app_dir` e `react_exports`)

## 1. Scaffold do app

Padrão ds-agent (monorepo Nx/pnpm com apps Astro independentes):

1. Nome: do spec (`app_dir`), default `ds-<site>` (ex.: `ds-cury`).
2. Porta: escaneie `apps/*/package.json` existentes (`rg -o 'port \d+'`) e use a
   próxima livre a partir de 4000.
3. Copie `${CLAUDE_PLUGIN_ROOT}/templates/astro-app/` para `apps/<nome>/`,
   removendo o sufixo `.tmpl` e preenchendo os marcadores:
   - `package.json`, `astro.config.mjs`, `tsconfig.json`
   - `project.json` **somente se** o repo tem `nx.json` na raiz
   - `src/layouts/BaseLayout.astro`, `src/pages/index.astro`
   - Os `.css.tmpl` e `design-system.astro.tmpl`/`_Component.astro.tmpl` ficam
     como referência para as tasks — NÃO os copie preenchidos agora; as tasks
     das waves é que geram esses arquivos.
4. Se o repo é pnpm workspace, confirme que `apps/*` está no
   `pnpm-workspace.yaml`.

## 2. Geração das tasks

Em `apps/<nome>/specs/ds-build/`, gere um arquivo por task usando
`${CLAUDE_PLUGIN_ROOT}/templates/shared/build-task.md.tmpl`. Numeração por wave:

```
00-foundation-tokens.md      → src/styles/design-system/tokens.css (+ fontes)
01-foundation-typography.md  → typography.css
02-foundation-layout.md      → layout.css
20-motion.md                 → animations.css
10..1N-components-<grupo>.md → grupos de 3–6 componentes do spec:
                               actions, forms, surfaces, feedback, navigation,
                               data... (somente os grupos que o spec requer)
30-showcase.md               → src/pages/design-system.astro
31-docs-manifest.md          → design-system.manifest.json + DESIGN_SYSTEM.md
32-react-exports.md          → ds-exports/ (somente se react_exports: true)
```

Regras ao preencher cada task:
- **Arquivos de saída exatos** — é o mecanismo anti-conflito. Cada task de
  componentes escreve seus `.astro` + UM css próprio
  (`components/<grupo>.css`). Nenhuma task toca `index.css` nem manifest
  (exceto a 31, que é a única dona do manifest).
- Componentes com item no `gaps.md` → `provenance: designed`, com a diretriz do
  gap copiada na task; os demais → `extracted` com a entrada do consolidated.
- Critérios de aceite objetivos (estados, variantes, a11y) — vêm do spec e do
  component-catalog.
- Task 30 (showcase) referencia `references/showcase-rules.md`; task 31
  referencia `references/manifest-schema.md`; tasks de componentes referenciam
  `references/component-catalog.md`; task 32, `references/react-next-consumption.md`.

## 3. Execução em waves

Dispare cada wave como chamadas paralelas da Agent tool
(`subagent_type: ds-builder`), prompt mínimo por task:

```
task: <path absoluto do arquivo da task>
appDir: <path absoluto de apps/<nome>>
cacheDir: <path absoluto do cache>
analysis: <cacheDir>/analysis/
```

- **Wave 1**: 00, 01, 02, 20 (fundação CSS — só dependem da análise)
- **Gate**: confira que os arquivos declarados existem. Aí escreva você o
  `src/styles/design-system/index.css` inicial (imports de tokens, typography,
  layout, animations).
- **Wave 2**: todas as 1N de componentes (dependem só da fundação)
- **Gate**: arquivos existem? Acrescente os `@import './components/<grupo>.css'`
  ao index.css (você, não os builders).
- **Wave 3**: 30, 31, 32 (dependem de tudo)
- Builder falhou/retornou null? Re-dispare a task uma vez; persistindo, execute
  você mesmo.

## 4. Fechamento

1. `pnpm install` na raiz do workspace (ou do app, se standalone).
2. `pnpm exec nx build <nome>` (ou `pnpm --dir apps/<nome> build`). Corrija
   erros de compilação — tipicamente imports errados entre arquivos de tasks
   diferentes.
3. Valide o manifest:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-manifest.js" apps/<nome>/design-system.manifest.json`
4. Reporte: arquivos por wave, componentes extracted × designed, como rodar o
   showcase, e sugira a próxima fase: `/ds-review apps/<nome> <cache>`.
