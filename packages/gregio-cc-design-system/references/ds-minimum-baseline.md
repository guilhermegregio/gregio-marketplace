# Baseline — o mínimo viável de um design system

Use este baseline quando o usuário não sabe (ou não quer detalhar) o que precisa
no DS, ou quando a flag `--baseline`/`--skip-brainstorm` for usada. Ele existe para
que nenhum DS saia incompleto: é o conjunto que qualquer app consegue consumir.
No brainstorm, copie-o para o `ds-spec.md` e deixe o usuário só adicionar/remover.

## Tokens

| Categoria | Mínimo |
|---|---|
| Cores | `primary` (+hover/active), `accent`, `surface-1/2/3` (fundo, card, elevado), `text-1/2/3` (título, corpo, muted), `border`, feedback: `success`, `warning`, `danger`, `info` |
| Tipografia | 2 famílias (display + body; mono se houver código). Scale: `h1`–`h6`, `body-lg`, `body`, `body-sm`, `caption` — cada uma com size, line-height, weight |
| Spacing | escala base-4px: `0, 1(4px), 2(8px), 3(12px), 4(16px), 6(24px), 8(32px), 12(48px), 16(64px), 24(96px)` |
| Radii | `sm`, `md`, `lg`, `full` |
| Shadows | `sm`, `md`, `lg` |
| Breakpoints | `sm 640`, `md 768`, `lg 1024`, `xl 1280` |
| Z-index | `base 0`, `dropdown 100`, `sticky 200`, `overlay 300`, `modal 400`, `toast 500` |
| Motion | durações `fast 150ms`, `base 250ms`, `slow 400ms`; easings `ease-out` padrão + 1 expressivo (ex.: cubic-bezier(0.16, 1, 0.3, 1)) |

Valores acima são defaults sensatos — quando há site extraído, os valores vêm da
análise; o baseline define **o que precisa existir**, não o valor exato.

## Componentes

**Tier 1 — sempre incluir:**
Button (primary, secondary, ghost; estados hover/focus/disabled/loading),
Input (text; estados focus/error/disabled), Select, Checkbox, Radio, Switch,
Card (default + 1 variante), Badge, Alert (4 níveis de feedback), Modal (com focus
trap), Tabs, Tooltip, Nav/Header (sticky + mobile), Footer, Avatar, Table.

**Tier 2 — perguntar ao usuário (incluir se o app alvo precisar):**
Accordion, Breadcrumb, Pagination, Toast, Dropdown menu, Skeleton, Progress,
Hero pattern, Section patterns (features, CTA, pricing).

## Layout

Container central, Stack (espaçamento vertical), `grid-2/3/4` responsivos, Section
(padding vertical consistente). Mobile-first.

## Motion mínimo

- Transition em todo interativo (hover/focus) usando os tokens de duração/easing
- 1 animação de entrada (fade + slide-up) com classes de delay
- Spinner/loading
- `prefers-reduced-motion: reduce` desligando animações — obrigatório, é a11y

## A11y mínimo

Contraste AA (4.5:1 texto, 3:1 elementos grandes), `:focus-visible` em todo
interativo, touch targets ≥ 44px, ARIA nos compostos (Modal, Tabs, Accordion,
Tooltip), navegação por teclado nos compostos.
