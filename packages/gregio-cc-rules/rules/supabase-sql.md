---
rule: supabase-sql
stacks: [sql]
version: 1
---

# Supabase — migrations, RPC e RLS

## Migration é idempotente e reversível de cabeça

`create ... if not exists`, `on conflict do update`, `update ... where` com filtro
explícito. Migration que só roda uma vez em banco limpo não sobrevive ao primeiro
ambiente divergente.

## Reapontar um enum/slug existente pode derrubar outro produto

Antes de reusar uma linha de catálogo (modalidade, tipo, plano), verifique **quem já
depende dela**. Reapontar quebra o consumidor silenciosamente. O certo costuma ser
criar a linha nova e migrar as ativações.

## RPC com parâmetro de segmentação precisa do caso "todos"

RPC que filtra por tier/plano/parceiro sempre acaba precisando de um valor que dispensa
o filtro. Sem ele, o chamador escolhe um bucket errado e a query volta **vazia** — o
sintoma mais difícil de diagnosticar, porque não é erro.

## Filtro de "registro vigente" na origem

Se a tabela tem `is_active`, a RPC que alimenta pipeline filtra por ele. Registro
arquivado com status legado vira trabalho fantasma rio abaixo.

## RLS pelos helpers, não por join solto

Use as funções de contexto do projeto (ex.: `b2b_current_student_ids()`); policy
escrita à mão em cada tabela diverge com o tempo.

## Seed de demo é idempotente e escopado

Seed que "limpa o que existe" precisa do mesmo cuidado de escopo do app: arquivar
`where status='active'` sem filtrar a modalidade apaga o plano do produto vizinho.
