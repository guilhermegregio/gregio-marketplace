---
rule: n8n-workflows
stacks: [n8n]
version: 2
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

## Deploy é pela API, nunca pela CLI de dentro do container

`n8n import:workflow` grava direto no banco e **não avisa a instância em execução** —
cada processo (main, worker, webhook) segue servindo o que tem em memória. O sintoma é
o pior possível: **intermitente**. Execuções alternam entre a versão nova e a velha
conforme o processo que pegar o job, e o banco mostra o conteúdo certo o tempo todo.
Ainda por cima, o `import` **desativa** o workflow (o `active` não vem no JSON), e você
descobre isso só quando o scheduler não dispara.

O deploy correto passa pelo processo que está rodando: **API REST** (a mesma que a UI
usa) ou a UI. Aí o n8n desregistra e registra o trigger de novo, e a mudança vale na
hora — sem `docker restart`.

```bash
# reload sem downtime perceptível (o conteúdo já está correto no banco)
POST $N8N_API_URL/workflows/<id>/deactivate
POST $N8N_API_URL/workflows/<id>/activate
```

Se você se pegou pensando "vou reiniciar o container para a mudança pegar", o deploy
foi pelo caminho errado. Confirme o que **de fato executou** em
`execution_data.workflowData` — é o único lugar que mostra a versão que rodou.

## Campo que não está no `schema` do `executeWorkflow` é descartado em silêncio

No nó Execute Workflow, `workflowInputs.schema` é **allowlist**: o que está em `value`
mas não no `schema` não é enviado, e o sub-workflow recebe `null`. Editar o JSON à mão
para acrescentar um input novo ao `Start` do sub **não** atualiza o schema do chamador
(a UI regenera; o editor de texto não).

Cicatriz real: `partnerId`/`b2bStudentId` mapeados no `00-macrocycles` e ausentes do
schema ⇒ o `01` tratou aluno de parceiro como B2C, exigiu assinatura que ele nunca tem,
marcou a anamnese como `error` (terminal) e ninguém viu — execução **verde**. Note que
`schema: []` (vazio) é o caso oposto: sem schema não há filtro, passa tudo.

## Subworkflow pode precisar de `active=true`

A convenção antiga ("subworkflow roda inativo") não vale em todas as versões: há n8n
que responde `Workflow is not active and cannot be executed`. Se o `executeWorkflow`
falhar assim, ative o subworkflow e reinicie.
