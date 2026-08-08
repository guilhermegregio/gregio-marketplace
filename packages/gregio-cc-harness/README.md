# gregio-cc-harness

Bootstrap e diagnóstico do harness — **o código vive no engine `kb`** (`cli/kb`
deste repo). Este package é a camada fina que ensina os comandos e guarda o
contrato deles.

```bash
kb doctor                    # relatório ✓/✗ do conjunto (exit 1 se houver ✗)
kb status [dir] [--all]      # trabalho não salvo nos repos (exit 1 se houver risco)
kb map [dir]                 # repos git de ~/code fora do kb
kb rules <repo>              # materializa as rules (package gregio-cc-rules)
kb guard                     # hook PreToolUse dos guardrails (stdin/stdout JSON)
```

`scripts/harness.mjs` continua no lugar apenas como stub de deprecação: imprime
o comando `kb` equivalente e sai com 1.

## `kb doctor`

Valida o conjunto e imprime ✓/✗ por item:

- **kb config** existe (`~/.config/kb/config.json`, respeitando `KB_CONFIG` e
  `XDG_CONFIG_HOME`)
- **plugins** instalados (scope user) estão habilitados em `enabledPlugins` do
  `~/.claude/settings.json` — plugin instalado mas desabilitado é silencioso
- **hook do guard** presente em `hooks.PreToolUse`; passa com `kb guard` e
  também com o `guard.mjs` antigo (transição), aí com nota de migração
- **graphify** responde e não emite warning de skill desatualizada
- **n8n dev**: se o container `n8n-dev` existe, nenhum workflow importado aponta
  para o auth de produção (credencial dev usando prod)

Sai com 1 se qualquer check falhar — usável em automação. Check pulado
(docker/graphify ausente) imprime `-` e não conta como falha.

## `kb status` — trabalho não salvo

```bash
kb status              # só o que tem risco (exit 1 se houver)
kb status --all        # inclui os repos limpos
kb status ~/outro      # outra base
```

| achado | por que importa |
|---|---|
| mudanças não commitadas | o clássico |
| commits não enviados / não baixados | `ahead`/`behind` do upstream |
| **branch não mergeada** | `wtree --rm -f` apaga branch sem perguntar — já custou um `git fsck` |
| **worktree ativo** | trabalho aberto que ninguém lembra que existe |
| **diretório órfão em `~/code/worktrees`** | sobra de worktree removido: o git não conhece mais, os arquivos ficam |
| stash pendente | o esconderijo que todo mundo esquece |

Substitui o antigo `~/code/check-uncommitted.sh` (que só via uncommitted +
ahead/behind) — os itens em negrito são o risco que o fluxo com worktree
acrescentou. **Nunca apaga nada**: o órfão vem com o `rm -rf` pronto para
copiar.

**Órfão com arquivos de outro dono**: volume de container (supabase local, por
exemplo) deixa restos como `nobody`/`root` dentro do worktree. O `rm -rf` do
usuário falha com "Permissão negada", então o output detecta o caso e sugere a
via que funciona:

```bash
docker run --rm -v ~/code/worktrees:/w alpine rm -rf /w/<dir>
```

## `kb map`

Varre `~/code` (1 nível, dirs com `.git`), cruza com os `projects` **e**
`vaults` do kb config e lista os não registrados, sugerindo
`kb project add <path>`. Não executa nada — registrar repo é decisão do humano.

## Instalar o guardrail num repo

O antigo `harness install` sumiu: virou dois passos explícitos.

```bash
kb rules <repo>        # rules por stack em <repo>/.claude/rules
```

e o hook, uma vez, em `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|NotebookEdit",
        "hooks": [{ "type": "command", "command": "kb guard" }]
      }
    ]
  }
}
```

| guardrail | quando | decisão |
|---|---|---|
| 🧊 contrato congelado | `Edit`/`Write` num `behaviors.feature` sob `kb dev freeze` | **deny** |
| 🌳 feature na main | escrita em repo registrado no kb, branch `main`, com plano ativo | **aviso** |

## Requisitos

Node ≥ 20, zero dependências. `docker` e `graphify` são opcionais — checks que
dependem deles são pulados ou acusados conforme o caso.
