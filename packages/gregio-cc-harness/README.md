# gregio-cc-harness

CLI de bootstrap do harness: valida, mapeia e instala o conjunto de ferramentas
(kb, rules, hooks, plugins) que fazem o Claude Code funcionar do jeito certo em
qualquer máquina/repo.

## Uso

```bash
node scripts/harness.mjs doctor            # relatório ✓/✗ do conjunto (exit 1 se houver ✗)
node scripts/harness.mjs map               # repos de ~/code não registrados no kb
node scripts/harness.mjs install <repo>    # rules + hook guard.mjs (aceita --dry-run)
```

## Subcomandos

### `doctor`

Valida o conjunto e imprime relatório com ✓/✗:

- **kb config** existe (`~/.config/kb/config.json`, respeitando `XDG_CONFIG_HOME`)
- **plugins** instalados (scope user) estão habilitados em `enabledPlugins` do
  `~/.claude/settings.json` — plugin instalado mas desabilitado é silencioso
- **hook guard.mjs** presente em `hooks.PreToolUse` (guardrail de freeze/wtree)
- **graphify** responde e não emite warning de skill desatualizada
- **n8n dev**: se o container `n8n-dev` existe, nenhum workflow importado aponta
  para o auth de produção (credencial dev usando prod)

Sai com código 1 se qualquer check falhar — usável em automação.

### `map`

Varre `~/code` (top-level, dirs com `.git`), cruza com os `projects` e `vaults`
do kb config e lista os repos não registrados, sugerindo o comando
`kb project add <path>`. Não executa nada — só sugere.

### `install <repo>`

1. Materializa as rules por stack delegando ao
   [`gregio-cc-rules`](../gregio-cc-rules) (`install-rules.mjs` — auto-detecção,
   idempotência e `--prune` são de lá).
2. Confere/insere o hook `guard.mjs` em `hooks.PreToolUse` do
   `~/.claude/settings.json` global — idempotente, com backup `.bak` antes de
   qualquer escrita.

Com `--dry-run` mostra o que faria sem escrever nada.

## Requisitos

Node ≥ 20, zero dependências. `docker` e `graphify` são opcionais — checks que
dependem deles são pulados/acusados conforme o caso.
