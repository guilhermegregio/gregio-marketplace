#!/bin/sh
# Hook Stop/Notification: ponto de extensão. Se houver um executável
# `claude-notify` no PATH, ele recebe o JSON do evento no stdin; sem ele, nada
# acontece — a estação decide como notificar (som, desktop, chat).
command -v claude-notify >/dev/null 2>&1 || exit 0
exec claude-notify
