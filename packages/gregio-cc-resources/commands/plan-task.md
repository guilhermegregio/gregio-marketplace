---
description: Refine current plan to add or change features
---

# Implementation

Leia @specs/current.md para fazer um brainstorm de alterações no plano, conforme o <requirements/> abaixo:

<requirements>
$ARGUMENTS
</requirements>

Sempre estruture da seguinte forma:
- @specs/current.md visão macro do plano
- @specs/tasks armazeda os detalhes do plano em arquivos separados por tasks/fases
- @specs/state.json armazens o status de todas as tasks em pending,proccess,done

Estrutura do arquivo de @specs/state.json

```json
{
  "title": "Lista de terefas",
  "type": "object",
  "additionalProperties": false,
  "required": ["nextTask", "tasks"],
  "properties": {
    "nextTask": {
      "type": "string",
      "description": "Ref para o arquivo da próxima task.",
      "pattern": "^\\./(?:[A-Za-z0-9_\\-]+/)*[A-Za-z0-9_\\-]+\\.md$"
    },
    "tasks": {
      "type": "array",
      "description": "Lista de tarefas.",
      "items": { "$ref": "#/$defs/task" }
    }
  },
  "$defs": {
    "task": {
      "type": "object",
      "additionalProperties": false,
      "required": ["file", "status", "completedAt"],
      "properties": {
        "file": {
          "type": "string",
          "description": "Ref ao arquivo detalhado da task.",
          "pattern": "^\\./(?:[A-Za-z0-9_\\-]+/)*[A-Za-z0-9_\\-]+\\.md$"
        },
        "status": {
          "type": "string",
          "description": "Status da task.",
          "enum": ["pending", "done", "canceled"]
        },
        "completedAt": {
          "description": "Data/hora de conclusão (RFC3339) ou vazio quando não concluída.",
          "oneOf": [
            { "type": "string", "const": "" },
            { "type": "string", "format": "date-time" }
          ],
          "default": ""
        }
      }
    }
  }
}
```

**importante:**

caso não receba nada em <requirements/> leia o arquivo @specs/current.md e aguarde instruções para alteração no plano;

ao perceber que se trata de uma alteraćão atualize todos os arquivos necessário;
ao perceber que se trata de incluir adicione e altere todos os arquivos necessário;
ao perceber que se trata de remover algo remova e altere todos os arquivos necessários;

ao entender e finalizar o planejamento pergunte se quer implementar as proximas tasks e caso sim execute eles com sub-agents sampre
