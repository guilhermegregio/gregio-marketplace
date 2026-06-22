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
type: project | plan | adr | c4 | research | learning | pattern | source | content | doc | moc
title: Título legível
status: idea | active | paused | done | archived
projects: [nome-projeto]      # projetos que esta nota toca
groups: [nome-grupo]          # produtos/iniciativas (cross-projeto)
stack: [typescript, supabase] # tecnologias
tags: [auth, mobile]
visibility: {{VISIBILITY}}    # private | team-nxt | team-stone | shared | public
created: AAAA-MM-DD
updated: AAAA-MM-DD
---
```

## Regras

- `visibility` default deste vault: **{{VISIBILITY}}**. Não rebaixar sem intenção.
- Nomes de arquivo em `kebab-case`. IDs são `<vault>-<categoria>-<slug>`.
- Links entre notas via `[[wikilink]]`. Linke liberalmente.
- Datas absolutas (nunca "ontem"/"semana passada").
- Não duplicar: antes de criar, procure nota existente e atualize-a.
