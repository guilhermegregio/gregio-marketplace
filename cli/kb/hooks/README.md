# Hooks do harness

`guard.mjs` — hook `PreToolUse` do Claude Code com os dois guardrails:

| guardrail | quando | decisão |
|---|---|---|
| 🧊 contrato congelado | `Edit`/`Write` num `behaviors.feature` sob `kb dev freeze` | **deny** |
| 🌳 feature na main | escrita em repo registrado no kb, branch `main`, com plano ativo | **aviso** |

O deny é duro de propósito: o contrato é o combinado com o usuário, e "consertar o
teste" é a saída fácil que destrói a garantia. O wtree é aviso porque hotfix, doc e
ajuste pontual na main são legítimos.

## Instalar

Em `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|NotebookEdit",
        "hooks": [
          { "type": "command", "command": "node ~/code/knowledge-gregio/hooks/guard.mjs" }
        ]
      }
    ]
  }
}
```

## Testar

```bash
echo '{"tool_input":{"file_path":"<arquivo>"}}' | node hooks/guard.mjs | jq .
```

## Garantias

- **Nunca trava o trabalho por defeito próprio**: índice ausente/corrompido, git
  indisponível, config ilegível → o hook libera.
- **Só incomoda com plano ativo**: sem plano `approved`/`in-progress` citando o repo,
  o aviso de main não aparece.
- **Zero dependência**: Node puro, sem instalação.
