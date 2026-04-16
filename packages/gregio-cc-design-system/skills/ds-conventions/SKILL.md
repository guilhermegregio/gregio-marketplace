---
name: ds-conventions
description: "Design system conventions enforcer — activates automatically when working in a project that contains a design-system.manifest.json file. Ensures all new UI code follows the established design system tokens, components, and patterns. This skill triggers when creating components, pages, modifying styles, adding UI elements, or discussing design in a project with an existing DS. Also triggers when the user asks about available tokens, components, or design conventions in the current project."
---

## Design System Active

This project has an active design system. Before creating or modifying any UI code, follow these rules.

## Step 1 — Load the DS

Read `design-system.manifest.json` in the project root (or `src/` for Astro). Also read `DESIGN_SYSTEM.md` for composition rules.

## Step 2 — Use Only DS Tokens

When writing CSS or inline styles:
- **Colors**: use `var(--{prefix}-{color-name})` — never hardcode hex/rgb
- **Fonts**: use `var(--{prefix}-font-{name})` — never hardcode font-family
- **Spacing**: use `var(--{prefix}-space-{n})` — never hardcode px/rem for spacing
- **Radii**: use `var(--{prefix}-radius-{size})` — never hardcode border-radius
- **Shadows**: use `var(--{prefix}-shadow-{size})` — never hardcode box-shadow
- **Easing**: use `var(--{prefix}-ease-{name})` — never hardcode cubic-bezier
- **Transitions**: use `var(--{prefix}-transition-{speed})` — never hardcode duration

The `{prefix}` is in `manifest.conventions.cssVarPrefix`.

## Step 3 — Use DS Components

When creating UI elements, check if a DS component already exists:
- Check `manifest.components` array for matching components
- Use the component's `baseClass` and `variants` — don't create new classes
- Respect the component's `states` and `props`
- Follow a11y requirements listed in the component

For **Astro** projects: import from `src/components/ds/`:
```astro
import Button from '../components/ds/Button.astro';
```

For **standalone**: use the HTML from `assets/snippets/`:
```html
<button class="ds-btn ds-btn-primary">Label</button>
```

## Step 4 — Use DS Layouts

- Container: `.{prefix}-container`
- Section: `.{prefix}-section`
- Grids: `.{prefix}-grid-2`, `.{prefix}-grid-3`, `.{prefix}-grid-4`
- Responsive: mobile-first, breakpoints from manifest

## Step 5 — Use DS Animations

- Entrance: `.reveal-up`, `.reveal-zoom`, `.reveal-left`, `.reveal-right`
- Delays: `.delay-100`, `.delay-300`, `.delay-500`, `.delay-700`
- Hover: `.{prefix}-hover-lift`, `.{prefix}-hover-glow`
- Add `prefers-reduced-motion` respect

## If Something New is Needed

If the UI requires a component, token, or pattern that doesn't exist in the DS:

1. **Don't invent it inline** — this breaks the DS as source of truth
2. **Suggest** running `/improve-ds --add=<component-name>` first
3. Only proceed with a temporary implementation if the user explicitly approves, and mark it with a `/* TODO: add to DS */` comment

## Quick Reference

To list available tokens: read `design-system.manifest.json` → `tokens`
To list available components: read `design-system.manifest.json` → `components`
To see how to use: read `DESIGN_SYSTEM.md`
To add new elements: use `/improve-ds`
To generate pages/components: use `/generate-from-ds`
