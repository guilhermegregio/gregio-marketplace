---
block: herdr
profiles: [all]
order: 30
version: 1
---

# EXECUÇÃO DE COMANDOS — herdr obrigatório

Você roda dentro do herdr (`HERDR_ENV=1`). Regra dura, mesmo peso da seção
COMANDOS PROIBIDOS:

**NUNCA chame a tool Bash com `run_in_background: true`.** Sem exceção.
Background shell do Claude Code é invisível pra mim: não vejo, não interajo, não
mato. Processo que não termina sozinho vai pra um **pane do herdr**.

Fronteira (aplique literalmente):

- **Bash normal, foreground** — comando one-shot que termina em segundos e cujo
  output você precisa ler: `git`, `rg`, `fd`, `jq`, `http GET` pontual, `cat`,
  teste rápido, build one-shot curto.
- **Pane do herdr** — qualquer coisa que fica viva ou demora: dev server, `--watch`,
  `tail`/logs, REPL, `nix build`/`fr`/`fu`, `docker compose up`, túnel, test runner
  em watch, e **todo caso em que você pensou "vou mandar pro background porque
  demora"**. Também vale quando você ia esticar o `timeout` do Bash pra caber.

Receita padrão — use direto, sem precisar carregar a skill:

```bash
PANE=$(herdr pane split "$HERDR_PANE_ID" --direction down --no-focus | jq -r '.result.pane.pane_id')
herdr pane run "$PANE" "pnpm dev"
herdr wait output "$PANE" --match "ready|listening" --regex --timeout 60000
herdr pane read "$PANE" --source recent --lines 40
```

Ao terminar: `herdr pane close "$PANE"`. Se o processo deve continuar vivo, deixe
aberto e **me diga o pane id** no fim da resposta.

Para qualquer coisa além dessa receita (spawnar agente, coordenar panes, ler pane
vizinho, esperar status de agente) — **leia a skill `herdr` antes de improvisar**.

Única exceção: se `HERDR_ENV` não for `1`, o herdr não está disponível; só nesse
caso o Bash background é aceitável.
