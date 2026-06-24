---
id: meta-obsidian-setup
type: doc
title: Setup do Obsidian (plugins)
status: active
visibility: {{VISIBILITY}}
created: {{DATE}}
updated: {{DATE}}
---

# Setup do Obsidian

Abra o **vault agregador** (`~/code/vault-all`) para ver todos os vaults numa janela.
O `.obsidian/` (config + plugins) vive só no agregador.

## Core plugins (ativar em Settings → Core plugins)

- **Bases** — renderiza as views `*.base` (dashboards de projetos/planos/inbox).
- **Properties** — edição do frontmatter como propriedades.

## Community plugins (recomendados)

- **Front Matter Title** — mostra o `title` do frontmatter na sidebar/abas em vez do
  nome do arquivo (resolve `_project`/`_plan` aparecerem iguais).
- **Folder Notes** — clicar na pasta abre o `_project.md`/`_plan.md` dela.

## Convenções de exibição

- As `.base` já ordenam por `title` + pasta; com o Front Matter Title a árvore fica
  legível.
- Não aponte o `graphify export --obsidian` para estes vaults (é view derivada, 1
  arquivo por nó — polui a autoria).
