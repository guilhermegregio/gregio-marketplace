---
id: meta-taxonomy
type: doc
title: Taxonomia — o que vai onde
status: active
visibility: {{VISIBILITY}}
created: {{DATE}}
updated: {{DATE}}
---

# Taxonomia (1 parágrafo por pasta)

- **10-projects/** — uma pasta por projeto: `_project.md` (casa: stack, repos, status),
  `architecture/` (C4 + ADRs do projeto), `plans/` (planos só deste projeto),
  `learnings/`.
- **20-systems/** — cross-projeto: `landscape-c4.md` (todas as marcas/serviços) e
  `integrations/` (uma nota por par de integração).
- **30-plans/** — planos que cruzam >1 projeto: `<slug>/_plan.md` + `execution/`.
- **40-knowledge/** — durável: `learnings/` (notas atômicas), `patterns/` (receitas),
  `concepts/`.
- **50-research/** — dossiês: `<topic>/_research.md`.
- **60-sources/** — captura: `_inbox.md`, `articles/`, `ideas/`.
- **90-content/** — produção: `<peça>/`.

Onde o `kb add` coloca cada `--as`: `article→60-sources/articles`,
`idea→60-sources/ideas`, `research→50-research/<topic>`,
`learning→40-knowledge/learnings`, `pattern→40-knowledge/patterns`,
`content→90-content/<slug>`.
