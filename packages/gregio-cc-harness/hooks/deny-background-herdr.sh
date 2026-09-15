#!/bin/sh
# Hook PreToolUse (Bash): dentro do herdr (HERDR_ENV=1), nega `run_in_background`
# — background shell do Claude Code é invisível para o humano. Fora do herdr não
# faz nada, igual ao bloco herdr do CLAUDE.md global.
[ "${HERDR_ENV:-}" = "1" ] || exit 0
if [ "$(jq -r '.tool_input.run_in_background // false')" = "true" ]; then
  printf '%s' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Background shell do Claude Code está proibido dentro do herdr (HERDR_ENV=1) — o usuário não vê nem controla esses shells. Rode em um pane: PANE=$(herdr pane split \"$HERDR_PANE_ID\" --direction down --no-focus | jq -r .result.pane.pane_id); herdr pane run \"$PANE\" \"<comando>\"; herdr pane wait-output --regex \"<texto esperado>\" --timeout 60000 \"$PANE\"; herdr pane read \"$PANE\" --source recent --lines 40. Se o comando termina em segundos, rode em foreground sem run_in_background."}}'
fi
