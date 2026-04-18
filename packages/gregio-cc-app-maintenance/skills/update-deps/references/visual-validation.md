# Visual validation com Chrome DevTools MCP

Validação visual roda só quando `has-dev-server.js` reporta `hasDevServer: true` e o usuário não passou `--no-visual`. O objetivo não é auditar design — é **catar erros silenciosos que build+test não pegam**: runtime exception no cliente, import quebrado que só aparece ao hidratar, CSS que não carrega, warning que virou erro em produção.

## Passos

### 1. Subir dev server em background

Use o comando retornado por `has-dev-server.js` (`command` + `port`):

```bash
# Exemplo (framework/port variam conforme script):
pnpm dev > /tmp/dev-server.log 2>&1 &
DEV_PID=$!
```

Salve o PID. Você vai precisar dele para derrubar o server ao final — **não deixe orfão**.

### 2. Esperar readiness

Não durma tempo fixo. Use o MCP para aguardar a URL responder:

```
mcp__chrome-devtools__new_page  →  URL: http://localhost:<port>
```

Se falhar na primeira, aguarde ~3s e tente de novo (até 5 tentativas / ~15s). Se depois disso não subir, leia `/tmp/dev-server.log` — provavelmente há erro de startup que já justifica falhar o fluxo.

### 3. Capturar sinais

Dispare essas chamadas em ordem:

1. `mcp__chrome-devtools__navigate_page` para `/` (home).
2. `mcp__chrome-devtools__list_console_messages` — lista todas mensagens do console.
3. `mcp__chrome-devtools__take_screenshot` — salva em `/tmp/update-deps-<timestamp>.png`.
4. `mcp__chrome-devtools__list_network_requests` — procure por 4xx/5xx inesperados.

### 4. Avaliar console

Filtre por `level: "error"`. Warnings são ignorados (muitas libs fazem warn em dev). Mas:
- Qualquer erro não-silenciável → falha o fluxo, volta para Phase 4 tentativa 2/3 do SKILL.
- Network errors 4xx/5xx em recursos do bundle (JS, CSS) → falha também.

### 5. Derrubar o server

**Sempre** — mesmo se deu erro:

```bash
kill $DEV_PID 2>/dev/null || true
# Garante que não ficou nada na porta:
lsof -ti:<port> | xargs -r kill -9 2>/dev/null || true
```

### 6. Entregar ao usuário

No resumo final, inclua:
- Caminho do screenshot (`/tmp/update-deps-*.png`)
- Número de erros de console (0 = passou)
- Número de requests falhos (0 = passou)

## Gotchas

- **Auth walls**: se a home redireciona para login, o screenshot vai mostrar a tela de login. Isso é OK para detectar crash, mas não cobre páginas autenticadas. Avise o usuário.
- **Cold start lento**: Next.js em dev pode demorar 30+s na primeira request (compila rotas). Dê margem no retry.
- **Portas ocupadas**: se a porta padrão está em uso, o framework pode subir em outra (Vite tenta 5173 → 5174 → ...). Parse o log do dev server para extrair a porta real em vez de confiar cegamente em `has-dev-server.js`.
- **Screenshots enormes**: use viewport padrão (1280×720) para manter os prints razoáveis. Page fulls só se o usuário pedir.
