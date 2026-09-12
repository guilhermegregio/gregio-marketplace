# gregio-cc-harness

Bootstrap e diagnóstico do harness — **o código vive no engine `kb`** (`cli/kb`
deste repo). Este package é a camada fina que ensina os comandos e guarda o
contrato deles.

```bash
kb scaffold [--profiles a,b] # prepara a estação: dirs do workspace + blocos do CLAUDE.md global
kb doctor                    # relatório ✓/✗ do conjunto (exit 1 se houver ✗)
kb status [dir] [--all]      # trabalho não salvo nos repos (exit 1 se houver risco)
kb map [dir]                 # repos git de ~/code fora do kb + cobertura repo → kb → vault (exit 1 se ✗)
kb rules <repo>              # materializa as rules (package gregio-cc-rules)
kb guard                     # hook PreToolUse dos guardrails (stdin/stdout JSON)
```

`scripts/harness.mjs` continua no lugar apenas como stub de deprecação: imprime
o comando `kb` equivalente e sai com 1.

## `kb scaffold` — bootstrap da estação

```bash
kb scaffold --profiles backend,frontend   # aplica e salva os perfis na config
kb scaffold                               # usa os perfis salvos (só "all" se não houver)
kb scaffold --dry-run                     # relata o que faria, sem escrever
kb scaffold --list                        # seletor: perfis e versões dos blocos
```

Faz duas coisas: cria `~/code`, `~/code/worktrees` e `~/code/.scratchpad` (com o
README que diz que o scratchpad é efêmero e substitui o `/tmp` para os agentes) e
gerencia os blocos do `~/.claude/CLAUDE.md`.

**Perfis** selecionam quais blocos entram. Os blocos `all` (`os-info`, `core`,
`herdr`, `git-worktree`) entram sempre; `backend` e `frontend` só com o perfil ativo.
`--profiles` é escolha explícita e fica salva em `scaffold.profiles` no kb config — da
segunda vez em diante `kb scaffold` sozinho basta. Trocar os perfis remove do CLAUDE.md
o bloco que saiu (só o que tem marcador).

**Marcadores** delimitam o que é gerenciado:

```markdown
<!-- kb-scaffold:begin core v1 -->
...miolo gerenciado pelo engine...
<!-- kb-scaffold:end core -->
```

O que ele **nunca** faz:

- **não toca em texto fora dos marcadores** — um CLAUDE.md artesanal só ganha os
  blocos anexados ao fim; migrar o texto à mão para dentro de bloco é decisão sua;
- **não reescreve bloco na mesma versão**, nem se o miolo foi editado à mão (por isso
  o retrato do `fastfetch` no `os-info` não se refaz a cada execução — só quando a
  versão do bloco sobe);
- **não apaga bloco que não conhece**: marcador sem template no engine fica como está
  e é apenas reportado;
- **não instala nada**. Pacote faltando é assunto do `kb doctor`, que sugere; quem roda
  o gerenciador de pacotes (ou o `npm i -g`) é o humano.

Rodar duas vezes não muda nada — idempotência é contrato, não gentileza. O passo a
passo de uma estação zerada (pacotes → suas configs → scaffold → doctor) está no
[README do engine](../../cli/kb/README.md#bootstrap-de-estação-nova).

## `kb doctor`

Valida **o que o harness precisa para rodar** e imprime ✓/✗ por item. O que é da sua
estação (repo de config do sistema, dotfiles aplicados, serviço local) não está aqui: vai
em `doctor.checks`, na seção seguinte.

- **kb config** existe (`~/.config/kb/config.json`, respeitando `KB_CONFIG` e
  `XDG_CONFIG_HOME`)
- **plugins** instalados (scope user) estão habilitados em `enabledPlugins` do
  `~/.claude/settings.json` — plugin instalado mas desabilitado é silencioso
- **hook do guard** presente em `hooks.PreToolUse`; passa com `kb guard` e
  também com o `guard.mjs` antigo (transição), aí com nota de migração
- **graphify** responde e não emite warning de skill desatualizada
- **rules disponíveis**: a cadeia de resolução do `kb rules` (`KB_RULES_DIR` → package
  irmão → `<engine>/rules` → plugin cache) chega em algum diretório com rules. O ✗ lista
  os caminhos tentados — sem isso o `kb rules` só falharia dentro do repo alvo

E os checks de estação, que dizem se a máquina sustenta o que o CLAUDE.md global manda
fazer:

| check | ✗ quando | correção sugerida |
|---|---|---|
| **`claude` no PATH** | o CLI não está no PATH (devflow, panes de agente e automações chamam pelo nome) | `npm i -g @anthropic-ai/claude-code`, ou o pacote do seu gerenciador declarativo |
| **ferramentas no PATH** | falta `rg`, `fd`, `jq`, `yq`, `http`, `gh`, `herdr`, `wtree` ou `pnpm` — um ✗ por ferramenta, porque a correção é por pacote | o gerenciador de pacotes da sua máquina (a dica é platform-aware: Nix, macOS, distro) |
| **node ≥ 20** | versão menor (o engine é ESM e usa `--env-file`) | mesma via da linha acima |
| **workspace `~/code`** | falta `~/code`, `~/code/worktrees` ou `~/code/.scratchpad` | `kb scaffold` |
| **blocos do `~/.claude/CLAUDE.md`** | bloco faltando, em versão menor que a do template, ou de perfil que saiu | `kb scaffold` |

O check dos blocos usa exatamente a mesma decisão do `kb scaffold` (a função pura
`planChanges`), então o doctor nunca manda rodar um comando que não mudaria nada.

Sai com 1 se qualquer check falhar — usável em automação. Check pulado (graphify
ausente, plataforma que não se aplica, `skip_if` de um check seu) imprime `-` e não
conta como falha. **O doctor nunca conserta nada**: ele imprime o comando pronto e o
humano roda.

### `doctor.checks` — os checks da sua estação

O engine não conhece a sua topologia de repos, nem os seus serviços. Declare esses
checks no seu `~/.config/kb/config.json` (`kb.config.example.json` tem um exemplo
pronto) e eles entram no mesmo relatório, depois dos checks do harness, na ordem do
array:

```json
{
  "doctor": {
    "checks": [
      { "type": "path", "label": "repo de config do sistema", "path": "~/meu-repo-de-sistema",
        "git": true, "platforms": ["linux", "darwin"], "fix": "clone e aplique o repo de config" },
      { "type": "symlink-inside", "label": "dotfiles aplicados", "path": "~/.config/algum-app/config.toml",
        "target": "~/meus-dotfiles", "fix": "rode o instalador dos dotfiles" },
      { "type": "command", "label": "serviço local não aponta para produção",
        "argv": ["docker", "exec", "meu-postgres-dev", "sh", "-c", "psql -tAc \"select count(*) from cfg where url like '%api.example.com%'\""],
        "expect_stdout": "/^0$/", "skip_if": ["docker", "info"],
        "fix": "troque a credencial de produção pela de dev no serviço local" }
    ]
  }
}
```

| tipo | ✓ quando |
|---|---|
| **`path`** | `path` existe; com `git: true`, exige também `<path>/.git` |
| **`symlink-inside`** | o realpath de `path` cai **dentro** de `target` — é assim que se prova symlink farm aplicada: repo clonado com o instalador nunca rodado deixa tudo "existindo" e nada no lugar |
| **`command`** | `argv` (executado **sem shell**) sai 0; com `expect_stdout`, quem decide é o casamento — `"/regex/flags"` é regex, qualquer outra string é substring |

Campos comuns:

- **`label` e `fix` são obrigatórios** — `fix` é o texto impresso junto do ✗, então
  escreva o comando que você mesmo rodaria;
- **`platforms`** (`linux`, `darwin`, `nixos`) restringe o check; fora da lista ele
  imprime `-` e não conta como falha. Numa estação NixOS casam `linux` **e** `nixos`;
- **`skip_if`** (só em `command`) é outro `argv`: se ele falhar, o check vira `-` em vez
  de ✗ — é como um check de container não acusa falha com o docker desligado.

⚠️ **O contrato read-only do doctor vale para os checks do engine.** Um `command` é seu:
o doctor executa o que você declarou, a cada execução — declare só comando que **lê**.
Config ausente ou malformada não derruba o relatório: vira um ✗ do próprio bloco (ou da
entrada inválida) e os outros checks seguem.

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

Depois vem a **cobertura** de cada projeto registrado: path existe, casa no vault
(com `_project.md`), casa em vários vaults sem `vault` na config, ponteiro `kb:link`
do `CLAUDE.md` apontando para a casa, e `10-projects/_index.md` de cada vault em dia.
Cada ✗ traz o comando de correção (`kb project add <path> --vault <v>`,
`kb project move <nome> --to-vault <v>`, `kb project link-claude <nome>`,
`kb vault index --vault <v>`) e o exit é 1 se houver ✗. Repo não registrado não
conta como ✗.

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
| 🧊 contrato congelado | `Edit`/`Write` num contrato `.feature.md` sob `kb dev freeze` — mora no vault, em `<vault>/10-projects/<projeto>/behaviors/` (contrato no repo é legado) | **deny** |
| 🌳 feature na main | escrita em repo registrado no kb, branch `main`, com plano ativo | **aviso** |

## Requisitos

Node ≥ 20, zero dependências. `graphify` é opcional — o check dele acusa quando falta.
`fastfetch` é opcional para o `kb scaffold`: sem ele o bloco `os-info` entra com a
instrução de rodar `fastfetch -l none` no lugar do retrato. Qualquer outra dependência
externa (docker, banco, serviço) só entra pelos seus `doctor.checks`, e o `skip_if`
existe para que ela desligada vire `-`, não ✗.
