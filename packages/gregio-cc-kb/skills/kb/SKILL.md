---
name: kb
description: "Lê e escreve a base de conhecimento pessoal do Gregio (vaults Obsidian-markdown multi-audiência + grafo central Graphify) SEM estourar contexto nem alucinar. Use SEMPRE que o usuário pedir para consultar/buscar/registrar conhecimento, ideias, projetos, planos, ADRs, learnings, research; quando perguntar 'o que eu sei sobre X', 'onde está a decisão sobre Y', 'planeje ponta-a-ponta entre projetos', 'adiciona isso na minha base', 'salva essa ideia/artigo'; ou citar vault/Obsidian/knowledge base. O protocolo é carregamento cirúrgico: router → índices → folhas alvo, e grafo (MCP) para perguntas cross-cutting. O engine de escrita é o CLI global 'kb' (gregio-marketplace/cli/kb)."
argument-hint: [pergunta | add <url> | capture "<texto>" | plan <objetivo>]
---

## O que é

A base de conhecimento do Gregio tem duas faces:

- **Substrato (autoria):** vaults Obsidian-markdown, um repo git por audiência —
  `vault-pessoal` (private), `vault-nxt` (team-nxt), `vault-stone` (team-stone),
  `vault-vivicupcakes` (shared). Cada vault segue a mesma estrutura numerada
  (`00-meta` … `90-content`). Um **vault agregador** local (`vault-all/`, symlinks)
  dá visão única no Obsidian; ele é só para humano.
- **Índice (consulta do agente):** grafos Graphify por-vault/projeto + um
  **grafo central** merge-ado (`~/.local/state/kb/central-graph.json`)
  com namespacing por `repo`, servido via MCP (stdio, local).

O **engine** é o CLI global `kb` (código em `~/code/gregio-marketplace/cli/kb`,
empacotado pelo nix; basta chamar `kb …` do PATH). A escrita SEMPRE passa por ele —
nunca crie notas no vault à mão por outro caminho.

## Regra de ouro: carregamento cirúrgico

NUNCA faça `ls -R` nem leia o vault inteiro. Protocolo, nesta ordem:

1. **Router raiz primeiro:** leia `00-meta/_index.md` do vault relevante. É um mapa
   minúsculo. Veja também `00-meta/conventions.md` (contrato) e `taxonomy.md` (o que
   vai onde) — uma vez por sessão, se necessário.
2. **Desça por índices:** cada pasta tem `_index.md` (MOC) com filhos + 1 linha +
   frontmatter. Leia o índice, não a pasta.
3. **Folhas só quando alvejadas:** abra `_project.md` / `_plan.md` / a nota
   específica apenas quando ela é o alvo.
4. **Cross-cutting → grafo (MCP):** "como o auth da NXT conecta com o billing da
   Stone?", "o que liga o app mobile ao design system?" → use as tools MCP do grafo
   central (`query_graph`, `get_neighbors`, `shortest_path`, `get_community`) em vez
   de ler 20 arquivos. Cite `source_location` ao afirmar um fato do grafo.
   - **Semântica de vault no grafo:** os nós-arquivo do vault carregam atributos de
     frontmatter (`fm_type`, `fm_projects`, `fm_groups`, `fm_visibility`, `fm_tags`, …)
     e os `[[wikilinks]]` são arestas `origin: wikilink`. Filtre por eles (ex.: todos os
     `fm_type=="learning"`, notas de um `fm_projects`, por `fm_visibility`) e navegue a
     teia de wikilinks — não leia pasta por pasta.
5. **Budget:** router + 1 índice + N notas-alvo. Precisou de mais? Vá ao grafo, não
   abra mais arquivos.

## Contrato de frontmatter (toda nota)

```yaml
id, type, title, status, projects[], groups[], stack[], tags[], visibility, created, updated
```

`type`: project|plan|adr|c4|research|learning|pattern|source|content|concept|moc|doc.
`status`: idea|active|paused|done|archived.
`visibility`: private|team-nxt|team-stone|shared|public (default = do vault).
`groups`: produtos/iniciativas que cruzam repos (ex.: `nxt`, `vivicupcakes`).

## Escrita — sempre via o CLI `kb`

O `kb` é global (nix) — rode de qualquer diretório:

```bash
# Ingerir URL roteada (artigo/ideia/research/...). Sem --as, infere por mídia.
kb add <url> --vault <n> [--as article|idea|research|learning|pattern|content] [--topic t] [--projects a,b] [--groups g] [--tags x,y] [--smart] [--no-update]

# Captura rápida no inbox
kb capture "<texto>" --vault <n> [--tags ...]

# Criar nota estruturada a partir de template
kb new --vault <n> --type project|plan|adr|c4|research|learning|pattern|content --title "..." [--project p] [--topic t]
```

Roteamento do `add --as`: `article→60-sources/articles`, `idea→60-sources/ideas`,
`research→50-research/<topic>`, `learning→40-knowledge/learnings`,
`pattern→40-knowledge/patterns`, `content→90-content/<slug>`. O `add` atualiza o
grafo do vault na raiz (gotcha de scan-root é tratado pelo engine). Depois de
escrever, lembre o usuário de commitar no repo do vault (o engine não commita repos
alheios).

## Projetos, grupos e grafo central

```bash
kb project add ~/code/<repo>   # detecta monorepo e registra subprojetos
kb group new <nome> --title "..." ; kb group add <grupo> <repo|repo#sub> ...
kb graph build [--group <g>]    # freshen por fonte + merge no central
kb graph serve                  # sobe o MCP do grafo central (stdio) + imprime config
```

**Grupo** = produto lógico que agrega vários repos (backend+frontend+mobile+DS+libs).
`graph build --group nxt` escopa o grafo só aos membros do produto NXT — use isso
para planejamento ponta-a-ponta focado.

## Planejamento ponta-a-ponta

Para "planeje X entre projetos": (1) resolva o grupo/projetos via grafo central
(MCP) para mapear o que se conecta; (2) leia só os `_project.md`/`_plan.md` alvo;
(3) registre o plano com `kb new --type plan` em `30-plans/<slug>/` com
`projects:[]`/`groups:[]` e tasks; (4) durante a execução, anexe progresso em
`30-plans/<slug>/execution/AAAA-MM-DD.md`; ao concluir, promova aprendizados para
`40-knowledge/learnings/` e marque o plano `done`.

**Só planos ativos.** Ao listar/varrer planos, considere **apenas** `30-plans/*`
(ativos). **Nunca** leia `30-plans/_archive/**` por padrão — planos concluídos são
arquivados ali (via `kb dev done`) e só entram no contexto sob pedido explícito ("o
que já foi feito em X?"). Assim um novo planejamento não herda ruído do histórico.

## Privacidade

O grafo central e o `vault-all/` agregador misturam TODAS as visibilidades — são
**locais, nunca compartilhados**. Só grafos/vaults de visibilidade única podem ser
compartilhados (e isso é decisão explícita do Gregio, não sua).

## Honestidade

- Não invente fatos do vault: se não leu a nota, diga que precisa abri-la.
- Ao citar o grafo, referencie `source_location`.
- Não rebaixe `visibility` de uma nota sem o usuário pedir.
