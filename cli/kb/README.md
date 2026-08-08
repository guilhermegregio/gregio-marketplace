# @gregio/kb

CLI do meu harness de desenvolvimento com IA. Faz duas coisas:

- **base de conhecimento** — ingestão e autoria em vaults Obsidian, grafo central
  (servido via MCP) e o ciclo de planos cross-project (`kb dev`);
- **harness** — bootstrap e guardrails do ambiente Claude Code (`kb doctor`,
  `kb status`, `kb map`, `kb rules`, `kb guard`).

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
| Vaults | `vault`, `aggregator` | criar/registrar vaults, sincronizar scaffold, montar o vault agregador |
| Registro | `project`, `group` | registrar repos e agrupá-los em produtos lógicos |
| Grafo | `graph build\|merge\|serve` | grafo central merge-ado, servido por MCP local |
| Planos | `dev start\|check\|freeze\|run\|done` | ciclo spec → protótipo → behaviors (congelados) → código → finish |
| Harness | `doctor`, `status`, `map`, `rules`, `guard` | diagnóstico do ambiente, trabalho não salvo, repos fora do kb, rules por stack, hook `PreToolUse` |

## Configuração

Estado fica fora do pacote, no XDG:

- `~/.config/kb/config.json` — vaults, projetos e grupos registrados
  (`KB_CONFIG` sobrescreve o caminho);
- `~/.local/state/kb/` — artefatos derivados, como o grafo central.

`kb.config.example.json` viaja no pacote como ponto de partida.

## Rules

`kb rules <repo>` materializa as rules do package `gregio-cc-rules` em
`<repo>/.claude/rules/`. No tarball do npm as rules viajam dentro do pacote (copiadas no
`prepack`); num checkout do marketplace o comando lê direto do package. `KB_RULES_DIR`
aponta para outro diretório quando você quer usar rules próprias.

## Licença

MIT.
