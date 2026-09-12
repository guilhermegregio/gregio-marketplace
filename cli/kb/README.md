# @gregio/kb

CLI do meu harness de desenvolvimento com IA. Faz duas coisas:

- **base de conhecimento** — ingestão e autoria em vaults Obsidian, grafo central
  (servido via MCP) e o ciclo de planos cross-project (`kb dev`);
- **harness** — bootstrap e guardrails do ambiente Claude Code (`kb scaffold`,
  `kb doctor`, `kb status`, `kb map`, `kb rules`, `kb guard`).

É opinativo: modela o meu fluxo (vaults por audiência, planos com contrato congelado,
rules materializadas por stack). Publicado porque é útil como referência e porque uso em
várias máquinas — não é um produto genérico.

## Instalação

```bash
# sem instalar nada
npx @gregio/kb --help

# global
npm i -g @gregio/kb

# nix (flake na raiz do gregio-marketplace)
nix run github:guilhermegregio/gregio-marketplace -- --help
nix profile install github:guilhermegregio/gregio-marketplace
```

Requer Node ≥ 20.6. Zero dependências de runtime.

## Comandos

`kb --help` tem a lista completa com flags. O mapa:

| Grupo | Comandos | Para quê |
|---|---|---|
| Autoria | `add`, `capture`, `new` | ingerir URL, captura rápida no inbox, nota a partir de template |
| Vaults | `vault`, `aggregator` | criar/registrar vaults, sincronizar scaffold, regenerar índices (`vault index`), montar o vault agregador |
| Registro | `project`, `group` | registrar repos (com o vault da casa), migrar a casa entre vaults (`project move`), agrupar em produtos lógicos |
| Grafo | `graph build\|merge\|serve` | grafo central merge-ado, servido por MCP local |
| Planos | `dev start\|check\|freeze\|run\|done` | ciclo spec → protótipo → behaviors (congelados, no vault) → código → finish |
| Harness | `scaffold`, `doctor`, `status`, `map`, `rules`, `guard` | bootstrap da estação, diagnóstico do ambiente, trabalho não salvo, cobertura repo → kb → vault, rules por stack, hook `PreToolUse` |

## Fronteira: repo × vault

**Repo = código + runtime** (`CLAUDE.md`, `references/` de skills, `graphify-out/`
só-código). **Vault = conhecimento** — docs, ADRs, planos, learnings e também os
**contratos**: o Gherkin de um plano mora na casa do projeto no vault,
`<vault>/10-projects/<projeto>/behaviors/<escopo>.feature.md` (um arquivo por app em
monorepo). No vault o contrato tem path único — não se duplica por worktree — e herda a
visibilidade do vault. O único rastro no repo é o bloco `kb:link` do `CLAUDE.md`
apontando para a casa.

## Contratos

Um contrato é um arquivo **`.feature.md`**: markdown com frontmatter, lido por humano e
por agente e indexado pelo grafo como qualquer nota — não é executado por cucumber.

```bash
kb new --vault pessoal --type contract --project agentic-os --title "Login" [--plan <slug>]
# → <vault>/10-projects/agentic-os/behaviors/login.feature.md
```

O arquivo nasce do template `templates/notes/contract.md`:

- frontmatter com `type: contract`, `status`, `plan` (só com `--plan`), `projects` (o
  `--project` entra se faltar), `groups`, `visibility` (a do vault por default); o `id`
  sai do título curto;
- título `# Contrato — <título>`;
- uma seção `## Funcionalidade: <nome>` por funcionalidade, com os cenários num bloco
  ` ```gherkin ` (`# language: pt`, `Funcionalidade:`, `Cenário:`, `Dado/Quando/Então`).

O slug vem do título; se o nome já existe, o `kb new` usa `<slug>-2.feature.md` (e assim por diante) em vez de
sobrescrever.

O `_plan.md` declara os contratos em `contracts:`, com entradas relativas a
`10-projects/` do vault do plano — com ou sem extensão:

```yaml
contracts:
  - agentic-os/behaviors/kb-cli.feature.md   # → <vault>/10-projects/agentic-os/behaviors/kb-cli.feature.md
  - agentic-os/behaviors/login               # sem extensão: tenta login.feature.md, depois login.feature (legado)
```

| entrada | resolve para |
|---|---|
| absoluta ou `~/…` | como está |
| relativa | `<vault do plano>/10-projects/<entrada>` |
| com extensão explícita | literal |
| sem extensão | `<entrada>.feature.md`; se só existir `<entrada>.feature`, usa esse — `.feature` puro é **legado**, com aviso no stderr sugerindo converter para `.feature.md` |
| relativa que só existe no repo de um dos `projects:` | o repo — **legado**, com aviso no stderr dizendo para onde mover |
| não existe em lugar nenhum | erro listando os paths tentados |

`kb dev start <slug> --vault <n> --project <p>` garante a pasta `behaviors/` na casa (e
cria o `_project.md` se faltar); `--no-contract` pula a task de behaviors. `kb dev freeze`
congela os arquivos resolvidos e o `kb guard` passa a negar edição neles —
`kb dev unfreeze <slug> --reason "..."` é o caminho quando o comportamento precisa mudar.
Freeze e guard não distinguem a extensão: vale o path resolvido.

**No grafo.** O enriquecimento do grafo de vault (`kb graph build`) trata contrato como
nota: o frontmatter vira atributo `fm_*` do nó-arquivo (inclusive `fm_type: "contract"` e
`fm_plan`) e surgem arestas `relation: "contracts"` — plano → contrato a partir do
`contracts:` do `_plan.md` (`origin: frontmatter`, com a mesma resolução sem extensão) e
casa (`10-projects/<p>/_project.md`) → contrato para todo arquivo sob
`10-projects/<p>/behaviors/` (`origin: folder`). Nó-arquivo é reconhecido também quando o
graphify prefixa o label com a pasta (nome de arquivo repetido, como `_project.md`).

## Casa do projeto: `map`, `project add --vault`, `project move`, `vault index`

```bash
kb map [dir]                                   # não registrados + cobertura (exit 1 se houver ✗)
kb project add <path> --vault <v>              # fixa o vault da casa do projeto
kb project move <nome> --to-vault <v> [--from-vault v] [--dry-run] [--no-link]
kb vault index [--vault v] [--dry-run]         # regenera os índices derivados do vault
```

- **`kb map`** lista os repos git de `~/code` fora do kb (não é falha: ficar fora é
  escolha) e a **cobertura** de cada projeto registrado: path existe, `vault` da config é
  um vault registrado, casa existe com `_project.md`, casa em mais de um vault sem
  `vault` na config, `CLAUDE.md` com ponteiro para a casa e `10-projects/_index.md` de
  cada vault listando todas as casas. Cada ✗ vem com o comando de correção; nada é
  executado.
- **`kb project add --vault <v>`** grava o vault da casa no projeto. O nome é validado
  antes de qualquer escrita.
- **`kb project move`** migra `10-projects/<pasta>/` inteira (behaviors incluso) para
  outro vault: `id` e `visibility` das notas, `vault` na config, contratos congelados
  repontados, ponteiro do `CLAUDE.md` (a menos de `--no-link`) e os índices dos dois
  vaults. Planos ficam no vault onde foram abertos — o comando só avisa quantos ativos
  citam o projeto. Tudo que pode falhar é checado antes da primeira escrita; `--dry-run`
  só mostra o plano; o commit nos vaults/repo é seu.
- **`kb vault index`** regenera `## Lista` de `10-projects/_index.md` e `## Ativos` de
  `30-plans/_index.md` a partir do frontmatter. Idempotente; sem `--vault`, todos.

## Bootstrap de estação nova

Ordem que funciona numa máquina zerada — cada passo depende do anterior:

1. **sistema** — instale pelo gerenciador de pacotes da sua máquina o que o `kb doctor`
   cobra: `rg`, `fd`, `jq`, `yq`, `http` (httpie), `gh`, `pnpm`, `herdr`, `wtree`,
   Node ≥ 20 e o CLI `claude`;
2. **suas configs** (dotfiles, symlink farm) — depois dos pacotes, senão o gerenciador
   passa por cima do que você acabou de linkar;
3. **estação** — `kb scaffold --profiles backend,frontend`: dirs do workspace + blocos
   gerenciados do `~/.claude/CLAUDE.md`;
4. **conferência** — `kb doctor`: o que ainda falta, com o comando de correção pronto.

```bash
kb scaffold --profiles backend,frontend
kb doctor
```

`kb scaffold` cria `~/code`, `~/code/worktrees` e `~/code/.scratchpad` e escreve os
blocos do `~/.claude/CLAUDE.md` **entre marcadores** (`<!-- kb-scaffold:begin <bloco>
v<n> -->`), selecionados pelos perfis — que ficam salvos em `scaffold.profiles` na
config, então a partir da segunda vez `kb scaffold` sozinho já basta. `--list` mostra o
seletor (perfis disponíveis × ativos, versão instalada × disponível) e `--dry-run`
relata sem escrever. Texto fora dos marcadores é intocável, e rodar duas vezes não
muda nada.

`kb doctor` é read-only: ele **sugere** o comando de correção (`kb scaffold`, o pacote a
instalar) e quem roda é você. Ele valida o que o harness precisa para rodar — config,
plugins, hook do guard, graphify, rules, ferramentas do contrato, workspace e blocos do
CLAUDE.md —, não a topologia de repos de ninguém. O que é da **sua** estação entra em
`doctor.checks` (abaixo). Flags, perfis e o que cada check cobre:
`packages/gregio-cc-harness/README.md`.

## Configuração

Estado fica fora do pacote, no XDG:

- `~/.config/kb/config.json` — vaults, projetos e grupos registrados
  (`KB_CONFIG` sobrescreve o caminho);
- `~/.local/state/kb/` — artefatos derivados, como o grafo central;
- `scaffold.profiles` no config guarda os perfis da estação (`backend`, `frontend`, …)
  — é o que `kb scaffold` e `kb doctor` usam quando você não passa `--profiles`;
- `doctor.checks` guarda os **checks extras** da sua estação.

`kb.config.example.json` viaja no pacote como ponto de partida.

### `doctor.checks` — as cicatrizes que são suas

O `kb doctor` só embute o que o harness precisa para rodar. O que é da sua máquina (o
repo de config do sistema, a symlink farm aplicada, o serviço local que não pode estar
apontando para produção) você declara na config — sem fork e sem patch:

```json
{
  "doctor": {
    "checks": [
      { "type": "path", "label": "repo de config do sistema", "path": "~/meu-repo-de-sistema",
        "git": true, "platforms": ["linux", "darwin"], "fix": "clone e aplique o repo de config" },
      { "type": "symlink-inside", "label": "dotfiles aplicados", "path": "~/.config/algum-app/config.toml",
        "target": "~/meus-dotfiles", "fix": "rode o instalador dos dotfiles" },
      { "type": "command", "label": "serviço local não aponta para produção",
        "argv": ["docker", "exec", "meu-postgres-dev", "sh", "-c", "psql -tAc 'select 1'"],
        "expect_stdout": "/^1$/", "skip_if": ["docker", "info"],
        "fix": "suba o serviço e revise a credencial" }
    ]
  }
}
```

| campo | vale para | o que faz |
|---|---|---|
| `label`, `fix` | todos (**obrigatórios**) | o nome na linha do relatório e a sugestão impressa no ✗ |
| `platforms` | todos | `linux`, `darwin`, `nixos` (NixOS é os dois: `linux` e `nixos`); fora da lista o check imprime `-` |
| `path`, `git` | `path` | o caminho existe; com `git: true`, exige também `<path>/.git` |
| `path`, `target` | `symlink-inside` | o realpath de `path` cai dentro de `target` — é como se prova symlink farm aplicada (repo clonado não prova) |
| `argv` | `command` | executado **sem shell**; ✓ se sair 0 |
| `expect_stdout` | `command` | quando presente, é ele que decide (comando que sempre sai 0 não provaria nada). `"/regex/flags"` é regex; qualquer outra string é substring |
| `skip_if` | `command` | outro `argv`; se ele falhar, o check vira `-` em vez de ✗ (docker desligado, por exemplo) |

O contrato **read-only** do doctor vale para os checks do engine; um `command` é seu:
declare só comando que **lê** (o doctor roda todos a cada execução). Config ausente ou
malformada nunca derruba o relatório — vira um ✗ do próprio bloco e o resto segue.

## Rules

`kb rules <repo>` materializa as rules do package `gregio-cc-rules` em
`<repo>/.claude/rules/`. No tarball do npm as rules viajam dentro do pacote (copiadas no
`prepack`); num checkout do marketplace o comando lê direto do package. `KB_RULES_DIR`
aponta para outro diretório quando você quer usar rules próprias.

## Licença

MIT.
