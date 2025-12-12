---
description: Consolide plan execution
---
# Consolidar e Finalizar Feature

Você deve consolidar a documentação da feature implementada e limpar os arquivos de planejamento para a próxima implementação.

## Argumento

O argumento `$ARGUMENTS` é o nome do módulo/feature (ex: `management-videos`, `auth-flow`, `workouts`).

Se não fornecido, analise o `specs/current.md` e `specs/state.json` para inferir o nome.

## Tarefas

### 1. Analisar a feature implementada

Leia os seguintes arquivos para entender a feature:
- `specs/current.md` - Plano geral
- `specs/state.json` - Tasks completadas
- `specs/tasks/*.md` - Detalhes de cada fase
- Arquivos de código relevantes (páginas, actions, migrations)

### 2. Criar pasta de documentação

Crie a pasta `specs/<nome-do-modulo>/` (use o argumento ou infira do contexto).

### 3. Criar README.md

Crie `specs/<nome-do-modulo>/README.md` com:

- **Visão Geral**: Descrição da feature e seus objetivos
- **Estrutura de Dados**: Tabelas, campos, tipos relevantes
- **Fluxos**: Diagramas ASCII de fluxos importantes
- **Regras de Negócio**: Lógica e validações importantes
- **Páginas/Rotas**: Lista de páginas com funcionalidades
- **RPCs/APIs**: Funções de banco e endpoints
- **Arquivos Principais**: Estrutura de arquivos do módulo
- **Migrations**: Lista de migrations relacionadas
- **Histórico**: Tabela com fases implementadas

### 4. Criar behaviors.feature

Crie `specs/<nome-do-modulo>/behaviors.feature` em formato Gherkin (BDD):

```gherkin
# language: pt

Funcionalidade: Nome da Feature
  Como [persona]
  Eu quero [objetivo]
  Para que [benefício]

  Contexto:
    Dado que [pré-condição comum]

  Cenário: Descrição do cenário
    Dado [contexto]
    Quando [ação]
    Então [resultado esperado]
```

Cubra os principais comportamentos:
- Fluxos felizes (happy path)
- Validações e erros
- Casos de borda
- Permissões/autorização

### 5. Limpar specs/current.md

Substitua o conteúdo por:

```markdown
# Plano Atual

Nenhum plano em andamento.

## Como usar

1. Crie um arquivo de plano em `specs/` descrevendo a feature
2. Atualize `specs/state.json` com as tasks
3. Execute `/next-task` para continuar a implementação

## Documentação de Features

Features concluídas estão documentadas em subpastas:

- `specs/<nome-do-modulo>/` - Descrição breve
```

Atualize a lista de features com todas as pastas existentes em `specs/`.

### 6. Limpar specs/state.json

Substitua por:

```json
{
  "nextTask": null,
  "tasks": []
}
```

### 7. Remover specs/tasks

Delete a pasta `specs/tasks/` e todo seu conteúdo.

### 8. Commit

Faça commit com a mensagem:

```
docs: consolidate <nome-do-modulo> feature documentation

- Add specs/<nome-do-modulo>/README.md with complete feature docs
- Add specs/<nome-do-modulo>/behaviors.feature with BDD scenarios
- Clean specs/current.md and specs/state.json for next feature
- Remove specs/tasks/ files (all phases completed)
```

## Exemplo de uso

```bash
# Com argumento explícito
/plan-finish management-videos

# Sem argumento (infere do contexto)
/plan-finish
```
