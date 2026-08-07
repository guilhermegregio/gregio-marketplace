---
rule: n8n-workflows
stacks: [n8n]
version: 1
---

# n8n — workflows versionados como JSON

Cicatrizes de uma validação E2E que só apareceram rodando de verdade.

## `executeWorkflow` aponta para o ID do PRÓPRIO grupo

Ao criar um pipeline copiando outro, os nós `executeWorkflow` continuam apontando para
os IDs do grupo de origem. O fluxo roda — chamando o pipeline errado. Confira **todo**
`workflowId.value` depois de copiar.

## Sem `$env` em expression

O n8n bloqueia acesso a env vars em expressions (`access to env vars denied`). URL de
serviço interno vai **fixa** no JSON; a troca por ambiente é feita no import
(transformação em memória), não em runtime.

## jsonb recebe objeto, não string

`={{ JSON.stringify(x) }}` num campo jsonb grava uma **string JSON** (double-encoded):
`data->'campo'` volta `null` e nada acusa erro. Passe `={{ x }}`.

## Colunas NOT NULL no INSERT de rascunho

Registro criado em estado `generating` precisa de placeholder para toda coluna NOT NULL
(`phase`, `parsed_data`…). O erro só aparece em runtime, no meio do pipeline.

## Credencial nunca cruza ambiente

Credencial do n8n de **dev** apontando para o banco de **prod** é um acidente à espera
de um scheduler ativo. Ao importar workflows entre ambientes, reaponte as credenciais e
confirme (`nodes::text` não pode conter o host de produção).

## Subworkflow pode precisar de `active=true`

A convenção antiga ("subworkflow roda inativo") não vale em todas as versões: há n8n
que responde `Workflow is not active and cannot be executed`. Se o `executeWorkflow`
falhar assim, ative o subworkflow e reinicie.
