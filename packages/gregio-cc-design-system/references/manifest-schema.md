# Design System Manifest Schema

Complete reference for `design-system.manifest.json` — the machine-readable source of truth that describes every token, component, animation, and convention in a design system.

---

## Top-Level Fields

```json
{
  "$schema": "design-system-v1",
  "name": "string",
  "version": "string",
  "generatedFrom": "string",
  "generatedAt": "string",
  "mode": "astro | standalone"
}
```

| Field | Required | Description |
|---|---|---|
| `$schema` | Yes | Always `"design-system-v1"`. Identifies the manifest version. |
| `name` | Yes | Human-readable name of the design system (e.g., `"Acme DS"`). |
| `version` | Yes | Semver string (e.g., `"1.0.0"`). Increment on each regeneration. |
| `generatedFrom` | Yes | Source URL or local path the DS was extracted from. |
| `generatedAt` | Yes | ISO 8601 timestamp of generation (e.g., `"2026-01-15T10:30:00Z"`). |
| `mode` | Yes | `"astro"` for Astro component output, `"standalone"` for vanilla HTML/CSS/JS. |

---

## meta

Metadata about the design system origin and aesthetic.

```json
"meta": {
  "aesthetic": "luxury",
  "sources": ["https://example.com"],
  "mergedFrom": [],
  "lastImprovedAt": null
}
```

| Field | Required | Description |
|---|---|---|
| `aesthetic` | Yes | One of: `"luxury"`, `"minimal"`, `"brutalist"`, `"playful"`, `"corporate"`, `"tech"`. Guides creative decisions when extending the DS. |
| `sources` | Yes | Array of URLs or paths used as visual references. At least one entry. |
| `mergedFrom` | No | Array of manifest file paths when this DS was created by merging multiple systems. Empty array if single-source. |
| `lastImprovedAt` | No | ISO 8601 timestamp of last `/improve-ds` run, or `null` if never improved. |

---

## entrypoints

Paths to the key files in the generated design system.

```json
"entrypoints": {
  "css": "src/styles/index.css",
  "js": "src/design-system.js",
  "showcase": "src/pages/design-system.astro",
  "components": "src/components/ds/"
}
```

| Field | Required | Description |
|---|---|---|
| `css` | Yes | Path to the main CSS file that imports/defines all tokens and component styles. |
| `js` | Conditional | Path to the JS bundle. Required when `mode` is `"standalone"`, `null` for Astro mode. |
| `showcase` | Yes | Path to the showcase/documentation page. |
| `components` | Yes | Path to the directory containing component files (.astro, .html, or .tsx). |

All paths are relative to the project root.

---

## tokens

The core design tokens organized by category.

### tokens.colors

```json
"colors": {
  "primary": {
    "value": "#6C3AFF",
    "rgb": "108,58,255",
    "usage": "primary",
    "cssVar": "--ds-primary"
  },
  "surface-card": {
    "value": "rgba(255,255,255,0.05)",
    "rgb": "255,255,255",
    "usage": "surface",
    "cssVar": "--ds-surface-card"
  }
}
```

| Field | Required | Description |
|---|---|---|
| `value` | Yes | The color value as used in CSS (hex, rgba, hsla). |
| `rgb` | Yes | Comma-separated RGB values for easy manipulation. |
| `usage` | Yes | Semantic role: `"primary"`, `"accent"`, `"surface"`, `"text"`, `"feedback"`, `"neutral"`. |
| `cssVar` | Yes | The CSS custom property name, always prefixed with `--ds-`. |

### tokens.fonts

```json
"fonts": {
  "display": {
    "family": "Space Grotesk",
    "fallback": "system-ui, sans-serif",
    "source": "google"
  },
  "primary": {
    "family": "Inter",
    "fallback": "system-ui, sans-serif",
    "source": "google"
  },
  "mono": {
    "family": "JetBrains Mono",
    "fallback": "monospace",
    "source": "google"
  }
}
```

| Field | Required | Description |
|---|---|---|
| `family` | Yes | Font family name as used in `font-family` declarations. |
| `fallback` | Yes | Fallback stack string. |
| `source` | Yes | One of: `"google"`, `"local"`, `"cdn"`. Indicates how the font is loaded. |

Keys: `display` (headings), `primary` (body), `mono` (code). Only `primary` is required; others are optional.

### tokens.typography

```json
"typography": [
  {
    "name": "h1",
    "element": "h1",
    "class": ".ds-h1",
    "fontSize": "48px",
    "lineHeight": "56px",
    "fontWeight": 700,
    "letterSpacing": "-0.02em",
    "fontFamily": "display"
  }
]
```

Array of type style definitions, ordered from largest to smallest.

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Token name (e.g., `"h1"`, `"body-lg"`, `"caption"`). |
| `element` | No | Default HTML element (`"h1"`, `"p"`, etc.). Null for utility classes. |
| `class` | Yes | CSS class to apply this style (e.g., `.ds-h1`). |
| `fontSize` | Yes | Font size in px. |
| `lineHeight` | Yes | Line height in px or unitless. |
| `fontWeight` | Yes | Numeric weight (400, 500, 600, 700, 800). |
| `letterSpacing` | No | Letter spacing value. Omit if normal. |
| `fontFamily` | Yes | Reference to a key in `tokens.fonts` (e.g., `"display"`, `"primary"`). |

### tokens.spacing

```json
"spacing": {
  "space-1": "0.25rem",
  "space-2": "0.5rem",
  "space-3": "0.75rem",
  "space-4": "1rem",
  "space-6": "1.5rem",
  "space-8": "2rem",
  "space-12": "3rem",
  "space-16": "4rem",
  "space-24": "6rem"
}
```

Key-value pairs. Keys follow the `space-{n}` convention. Values in rem.

### tokens.radii

```json
"radii": {
  "sm": "6px",
  "md": "12px",
  "lg": "20px",
  "full": "9999px"
}
```

All four keys are expected. Values in px.

### tokens.easing

```json
"easing": {
  "ease-out": "cubic-bezier(0, 0, 0.2, 1)",
  "ease-in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
  "ease-bounce": "cubic-bezier(0.34, 1.56, 0.64, 1)"
}
```

Key-value pairs. Values are valid CSS timing functions.

### tokens.breakpoints

```json
"breakpoints": {
  "sm": "640px",
  "md": "768px",
  "lg": "1024px",
  "xl": "1280px"
}
```

Standard responsive breakpoints. Values in px, used with `min-width` media queries (mobile-first).

### tokens.shadows

```json
"shadows": {
  "sm": "0 1px 3px rgba(0,0,0,0.12)",
  "md": "0 4px 12px rgba(0,0,0,0.15)",
  "lg": "0 8px 30px rgba(0,0,0,0.2)",
  "glow": "0 0 20px rgba(108,58,255,0.4)"
}
```

Values are complete `box-shadow` expressions. The `glow` key uses the accent/primary color.

### tokens.gradients

```json
"gradients": {
  "hero": {
    "value": "linear-gradient(135deg, #6C3AFF 0%, #FF6B6B 100%)",
    "usage": "background"
  },
  "text-accent": {
    "value": "linear-gradient(90deg, #6C3AFF, #00D4FF)",
    "usage": "text"
  }
}
```

| Field | Required | Description |
|---|---|---|
| `value` | Yes | Full CSS gradient expression. |
| `usage` | Yes | One of: `"text"`, `"background"`, `"border"`. |

### tokens.zIndex

```json
"zIndex": {
  "dropdown": "10",
  "sticky": "20",
  "modal": "50",
  "toast": "60"
}
```

String values (for direct CSS usage). Keys are semantic layer names.

---

## components

Array of component definitions.

```json
"components": [
  {
    "name": "button",
    "baseClass": ".ds-btn",
    "variants": [
      { "name": "primary", "class": ".ds-btn-primary", "when": "main CTA" },
      { "name": "secondary", "class": ".ds-btn-secondary", "when": "secondary actions" },
      { "name": "ghost", "class": ".ds-btn-ghost", "when": "tertiary/text actions" }
    ],
    "states": ["default", "hover", "active", "focus", "disabled", "loading"],
    "props": [
      { "name": "variant", "type": "'primary' | 'secondary' | 'ghost'", "default": "'primary'" },
      { "name": "size", "type": "'sm' | 'md' | 'lg'", "default": "'md'" }
    ],
    "a11y": {
      "role": "button",
      "focusVisible": true,
      "minTarget": "44px"
    },
    "source": "src/styles/components/button.css",
    "example": "<button class=\"ds-btn ds-btn-primary\">Click me</button>",
    "astroComponent": "src/components/ds/Button.astro",
    "snippet": "src/snippets/button.html",
    "reactComponent": null
  }
]
```

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Component identifier in kebab-case. |
| `baseClass` | Yes | The root CSS class (e.g., `.ds-btn`). |
| `variants` | Yes | Array of variant objects, each with `name`, `class`, and `when` (usage guidance). |
| `states` | Yes | Array of interactive state names the component supports. |
| `props` | Yes | Typed props for component generation. Each has `name`, `type` (TypeScript union), and `default`. |
| `a11y` | Yes | Accessibility requirements: `role`, `focusVisible`, `minTarget` size, and any ARIA attributes. |
| `source` | Yes | Path to the CSS file defining this component. |
| `example` | Yes | Minimal HTML snippet showing basic usage. |
| `astroComponent` | No | Path to generated Astro component, or `null`. |
| `snippet` | No | Path to standalone HTML snippet file, or `null`. |
| `reactComponent` | No | Path to generated React component, or `null`. |

---

## animations

Array of animation definitions.

```json
"animations": [
  {
    "name": "reveal-up",
    "class": ".reveal-up",
    "trigger": "IntersectionObserver + .is-visible",
    "duration": "800ms",
    "easing": "var(--ease-out)",
    "usage": "entrance",
    "source": "src/styles/animations.css"
  }
]
```

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Animation identifier. |
| `class` | Yes | CSS class that applies the animation. |
| `trigger` | Yes | How the animation is activated: CSS pseudo-class, JS event, IntersectionObserver, etc. |
| `duration` | Yes | Animation duration. |
| `easing` | Yes | Timing function (can reference a token via `var()`). |
| `usage` | Yes | Category: `"entrance"`, `"hover"`, `"background"`, `"loading"`, `"exit"`. |
| `source` | Yes | Path to the CSS file containing the `@keyframes` and class definition. |

---

## layoutPatterns

Array of reusable layout patterns found in the source.

```json
"layoutPatterns": [
  {
    "name": "hero-split",
    "when": "hero with text + visual",
    "markup": "<section class=\"ds-hero\"><div class=\"ds-container ds-grid-2\">...</div></section>"
  }
]
```

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Pattern identifier in kebab-case. |
| `when` | Yes | Description of when to use this pattern. |
| `markup` | Yes | Representative HTML structure (can be abbreviated with `...`). |

---

## icons

```json
"icons": {
  "system": "astro-icon",
  "collections": ["solar", "lucide"],
  "usage": "Use <Icon name=\"solar:star-bold\" /> for Astro or inline SVG for standalone."
}
```

| Field | Required | Description |
|---|---|---|
| `system` | Yes | One of: `"astro-icon"`, `"iconify"`, `"svg-inline"`, `"icon-font"`, `"none"`. |
| `collections` | No | Array of icon collection names used. Empty if `system` is `"none"`. |
| `usage` | Yes | Brief description of how to use icons in this DS. |

---

## conventions

```json
"conventions": {
  "classPrefix": "ds-",
  "cssVarPrefix": "--ds-",
  "responsive": "mobile-first",
  "darkMode": "none",
  "a11yLevel": "AA",
  "rtl": false
}
```

| Field | Required | Description |
|---|---|---|
| `classPrefix` | Yes | Prefix for all DS CSS classes (e.g., `"ds-"`). |
| `cssVarPrefix` | Yes | Prefix for all CSS custom properties (e.g., `"--ds-"`). |
| `responsive` | Yes | Strategy: `"mobile-first"` or `"desktop-first"`. |
| `darkMode` | Yes | Dark mode support: `"none"`, `"class"` (toggle via class), or `"media"` (prefers-color-scheme). |
| `a11yLevel` | Yes | Target WCAG level: `"AA"` or `"AAA"`. |
| `rtl` | Yes | Whether RTL layout support is included. Boolean. |

---

## exports

Paths to generated export files for consumption by other tools.

```json
"exports": {
  "cssTokensPath": "src/styles/tokens.css",
  "tsTokensPath": "src/tokens.ts",
  "reactComponentsPath": null
}
```

| Field | Required | Description |
|---|---|---|
| `cssTokensPath` | Yes | Path to the CSS file containing only token custom properties. |
| `tsTokensPath` | No | Path to TypeScript token definitions, or `null`. |
| `reactComponentsPath` | No | Path to React components directory, or `null`. |

---

## Validation Notes

- All paths are relative to the project root directory.
- The manifest must be valid JSON (no trailing commas, no comments).
- Arrays may be empty but should not be omitted — use `[]`.
- Optional object fields should be set to `null` rather than omitted, for consistent parsing.
- Color values in `tokens.colors` must include the `rgb` field even for rgba/hsla values (extract the base RGB).
- Component `example` fields must use the actual DS class names, not pseudocode.
- The `$schema` field must always be `"design-system-v1"` for this version of the spec.
