---
name: ds-review
description: "Run the final review of a generated design system app: a ds-reviewer agent checks spec coverage, token discipline (no hardcoded values), accessibility, showcase completeness and build health, fixing small gaps directly and reporting the rest. Use this skill when the user wants to review/audit/validate a built DS app, says 'revisar o DS', 'auditar o design system', 'review the design system app', 'cobrir gaps do DS', or right after /ds-build completes."
argument-hint: <app-dir> [cache-dir] [app-name]
---

## Your task

Com base nos argumentos abaixo:

<arguments>
$ARGUMENTS
</arguments>

Execute a **fase review** do pipeline de design system: agente `ds-reviewer`
sobre o app + verificação independente de manifest e build.

Siga o procedimento completo em `${CLAUDE_PLUGIN_ROOT}/references/pipeline/review.md`.

Resumo do contrato:
- `app-dir` é obrigatório (ex.: `apps/ds-cury`); `cache-dir` + `app-name`
  habilitam a verificação de cobertura do spec (workspace em
  `<cache-dir>/apps/<app-name>/`) — sem eles, avise que a revisão é parcial.
  `app-name` default = basename do `app-dir`.
- O reviewer corrige o que é pequeno e registra tudo em
  `<app-dir>/specs/ds-build/review.md`.
- Depois dele, valide você mesmo (validate-manifest + build) antes de reportar.
