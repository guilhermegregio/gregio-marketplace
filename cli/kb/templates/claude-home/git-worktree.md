---
block: git-worktree
profiles: [all]
order: 40
version: 3
---

# EXECUÇÃO COM GIT

**Feature em repo registrado no kb vai em worktree — nunca na main.** Regra dura, não
preferência: antes de começar a implementar, `wtree <branch-da-task>`. O comando já está
integrado com o herdr e cria o workspace com tudo certo (tab code + tab AI), inclusive um
pane já rodando um Claude Code na instância do worktree — veja `wtree --help`. Trabalhar
direto na main é aceitável só para hotfix, doc e ajuste pontual — e nesses casos, diga
que está na main.

Um hook (o subcomando `kb guard`) avisa quando você escreve na main de um repo com plano
ativo, e **bloqueia** edição de contrato congelado (`.feature.md` na casa do projeto no vault, sob
`kb dev freeze`) — nesse caso o certo é corrigir o código, ou pedir autorização e rodar
`kb dev unfreeze <plano> --reason "..."`.

Só crie branches se for solicitado.
