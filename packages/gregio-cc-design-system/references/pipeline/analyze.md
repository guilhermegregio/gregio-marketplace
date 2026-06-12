# Fase 3 — Analyze (análise multi-agente do cache)

Objetivo: transformar o site extraído em dados estruturados de design
(`analysis/`), usando 5 agentes especializados em paralelo — cada um faz uma
única coisa muito bem. O resultado consolidado é o proto-manifest que o build
consome, mais a lista de gaps (requerido pelo spec × ausente no site).

## Pré-requisitos

- Cache completo: `<cacheDir>/crawl.json` com `status: complete`
- Spec aprovado: `<workspace>/ds-spec.md` com `status: approved` no frontmatter,
  onde `workspace = <cacheDir>/apps/<app-name>`. Sem spec, pare e sugira
  `/ds-brainstorm` (a análise sem spec não sabe o que procurar nem o que vira gap).
- Se `<workspace>/analysis/consolidated.json` já existe e não foi pedido
  refazer, reporte o que existe e pare — a análise é cara, não a repita à toa.

## Dispatch dos analistas

Crie `<workspace>/analysis/` e dispare os **5 agentes em paralelo** (uma única
mensagem com 5 chamadas da Agent tool). `subagent_type` e outputs:

| subagent_type | reference a indicar | outputs |
|---|---|---|
| `ds-token-analyst` | `references/token-extraction.md` | `analysis/tokens.{json,md}` |
| `ds-typography-analyst` | `references/token-extraction.md` | `analysis/typography.{json,md}` |
| `ds-component-analyst` | `references/component-catalog.md` | `analysis/components.{json,md}` |
| `ds-motion-analyst` | `references/token-extraction.md` (seção motion) | `analysis/motion.{json,md}` |
| `ds-layout-analyst` | `references/token-extraction.md` | `analysis/layout.{json,md}` |

O prompt de cada um é curto — o método vive no próprio agente. Inclua apenas:

```
cacheDir: <path absoluto do cache>
spec: <workspace>/ds-spec.md
reference: ${CLAUDE_PLUGIN_ROOT}/references/<arquivo>
outputs:
  json: <workspace>/analysis/<nome>.json
  md: <workspace>/analysis/<nome>.md
```

Se o spec tem `components_ref` (white-label), acrescente ao prompt do
**ds-component-analyst** uma linha extra:

```
componentsRef: <path absoluto do DS de referência> (manifest + src/components/ds/)
```

## Consolidação (você, após os 5 retornarem)

1. Leia os 5 JSONs. Resolva sobreposições com estas regras:
   - **spacing/breakpoints**: layout-analyst vence (viu desktop×mobile)
   - **nomes de cores**: token-analyst vence; cores citadas por outros agentes
     devem referenciar esses nomes
   - **durações/easings**: motion-analyst vence
   - Conflito real de valores (dois agentes, valores diferentes para o mesmo
     conceito): prefira o de maior confidence; empate → o de evidência mais
     forte (computed.json > css > inferência)
2. Escreva `analysis/consolidated.json` — proto-manifest completo no formato do
   `references/manifest-schema.md` (tokens, components, animations,
   layoutPatterns, conventions), sem os campos de path (`entrypoints`,
   `source`, `astroComponent` — só existem pós-build). Preserve `evidence` e
   `confidence` agregados num campo `_analysis`.
3. Escreva `analysis/gaps.md` — o diff spec × site. Para cada componente/token
   da tabela do spec com `found: false` (ou ausente nos tokens):
   - Nome + o que o spec pede (variantes, estados)
   - Diretriz de design: que tokens usar por analogia ("Switch não existe;
     use primary para o estado on, radius full como os botões-pílula do site,
     transição base de 250ms")
   - Esses itens serão `provenance: designed` no build
   - **Com `components_ref`**: cada gap referencia o `.astro` do DS de
     referência como **contrato de API** — "preservar a interface Props de
     `<ref>/src/components/ds/X.astro` exatamente (white-label drop-in);
     re-estilizar com os tokens extraídos". A diretriz visual continua vindo da
     estética do site; a estrutura/props vêm da referência.
4. Escreva `analysis/ANALYSIS.md` — sumário executivo de uma tela: estética
   identificada, contagens, decisões de consolidação, gaps, riscos.

## Reporte

Liste contagens (tokens/componentes/animações/gaps), destaque ambiguidades que
o usuário deva validar, e sugira a próxima fase: `/ds-build`.

## Isolamento (regra de escopo)

O escopo desta fase é o workspace `<cacheDir>/apps/<app-name>/` + o crawl do
site. **Não leia** specs, análises ou apps de outros workspaces/DSs — runs
paralelas do mesmo site (ex.: ds-cury e ds-cury-test) existem justamente para
comparar soluções independentes, e olhar o vizinho contamina o resultado.
Exceções únicas: o DS de referência indicado em `components_ref` (contrato de
API) e, no build, o scan de `apps/*/package.json` só para achar porta livre.
