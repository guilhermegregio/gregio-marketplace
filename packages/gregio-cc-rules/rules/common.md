---
rule: common
stacks: [all]
version: 1
---

# Regras comuns

Poucas, e todas nasceram de bug real. Se uma regra aqui não tem cicatriz, ela não
deveria estar aqui.

## Escopo explícito vence heurística global

Quando uma função age sobre "o item atual", **receba qual é** — não adivinhe com
`.limit(1)`, `find(x => x.active)` ou "o primeiro da lista".

O modo de falhar é traiçoeiro: **nada quebra**. Compila, roda, e opera no alvo errado.
Descobre-se pelo efeito colateral, tarde.

```ts
// ✗ heurística: funciona até existir um segundo item
const modality = ctx.modalities.find((m) => m.active && m.anamnesis_modality);

// ✓ o chamador sabe qual é — a rota, o parâmetro, o clique
async function getPlanData(ctx: Ctx, modalitySlug: string) { … }
```

Sinais para procurar num diff: `.limit(1)`, `[0]`, `find(...active)`, update sem o
filtro que identifica o dono do registro.

## Gatilho de UI olha estado real, não flag de outro sistema

Um aviso/badge/bloqueio deve derivar do **fato observável** ("existe plano ativo?"),
não de uma coluna de status mantida por um pipeline externo. Se o pipeline falhar em
atualizar a flag, a UI mente — e mente exatamente para quem está no caso que importa.

```ts
// ✗ depende do n8n ter escrito 'done'
if (anamnese.status === "done") showNotice();
// ✓ o fato
if (activeMacrocycles.some((m) => m.modality_id === modality.id)) showNotice();
```

## Uma ação de um contexto não toca o estado de outro

Antes de um `update`/`delete` em lote, pergunte: *o que mais casa com esse filtro?*
Falta de um `.eq()` já arquivou dados de um produto vizinho em produção.

## Comentário explica o porquê, não o quê

O código já diz o que faz. O comentário guarda a decisão: a alternativa descartada, a
armadilha, o link para a spec. Comentário que parafraseia a linha seguinte é ruído.

## Build verde não prova integração

Type-check e build passam com o sistema inteiro desconectado. Antes de dizer "pronto",
rode no ambiente real: banco local, worker, scheduler. Ver o registro em vault
(`learnings/build-verde-nao-prova-integracao`).
