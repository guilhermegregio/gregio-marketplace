#!/bin/sh
# Hook PreToolUse (Bash): nega `grep`/`find` como comando — o bloco core do
# CLAUDE.md global proíbe os dois. Só casa em posição de comando (início, depois
# de ; & | ` ou $( ), então `rg grep` ou um path com "find" no nome passam.
cmd=$(jq -r '.tool_input.command // ""')
if printf '%s' "$cmd" | grep -qE '(^|[;&|`]|\$\()[[:space:]]*(grep|find)[[:space:]]'; then
  printf '%s' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Uso de grep/find via Bash está proibido neste setup. Use rg (ripgrep) no lugar de grep e fd no lugar de find. Melhor ainda: prefira as tools Grep e Glob, que já usam ripgrep internamente."}}'
fi
