---
id: meta-conventions
type: doc
title: Convenções — contrato de frontmatter e naming
status: active
visibility: {{VISIBILITY}}
created: {{DATE}}
updated: {{DATE}}
---

# Convenções (o contrato)

Toda nota tem frontmatter YAML. Este schema alimenta as views Bases, a extração do
Graphify e o filtro do agente.

## Campos núcleo

```yaml
---
id: slug-estavel-unico        # gerado pelo engine; não renomear à toa
type: project | plan | adr | c4 | contract | research | learning | pattern | source | content | doc | moc
title: Título legível
status: idea | active | paused | done | archived
projects: [nome-projeto]      # projetos que esta nota toca
groups: [nome-grupo]          # produtos/iniciativas (cross-projeto)
stack: [typescript, supabase] # tecnologias
tags: [auth, mobile]
visibility: {{VISIBILITY}}    # private | team-<nome-do-time> | shared | public
created: AAAA-MM-DD
updated: AAAA-MM-DD
---
```

## Regras

- `visibility` default deste vault: **{{VISIBILITY}}**. Não rebaixar sem intenção.
- `private`, `shared` e `public` valem em qualquer base; `team-<nome>` é um padrão
  aberto — quais times existem é escolha de quem monta os vaults (um vault por
  audiência, ver `kb vault list`).
- Nomes de arquivo em `kebab-case`. IDs são `<vault>-<categoria>-<slug>`.
- Links entre notas via `[[wikilink]]`. Linke liberalmente.
- Datas absolutas (nunca "ontem"/"semana passada").
- Não duplicar: antes de criar, procure nota existente e atualize-a.
- `type: contract` é o contrato de comportamento de um plano (devflow): arquivo
  `10-projects/<projeto>/behaviors/<escopo>.feature.md`, com `plan: <slug>` no
  frontmatter, `# Contrato — <título>`, uma seção `## Funcionalidade: <nome>` por
  funcionalidade e os cenários em bloco ` ```gherkin `. Crie com
  `kb new --type contract --project <p> --title <t> --plan <slug>`.
