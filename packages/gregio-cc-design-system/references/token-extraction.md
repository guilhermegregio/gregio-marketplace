# Token Extraction Guide

How to identify, extract, and organize design tokens from CSS and HTML source files. Tokens are the atomic values that define a design system: colors, typography, spacing, motion, and more.

---

## Colors

### Where to Find Them

- **CSS custom properties**: `--color-*`, `--primary`, `--accent`, `--bg-*`, `--text-*`, `--border-*`
- **Repeated literal values** in these properties: `color`, `background-color`, `background`, `border-color`, `fill`, `stroke`, `outline-color`, `box-shadow`, `text-shadow`, `text-decoration-color`
- **Inline styles** in HTML (less common but check)
- **SVG attributes**: `fill`, `stroke` on inline SVGs

### Extraction Steps

1. Collect all CSS custom properties that hold color values.
2. Scan all stylesheets for repeated hex (`#xxx`, `#xxxxxx`, `#xxxxxxxx`), `rgb()`, `rgba()`, `hsl()`, `hsla()` values.
3. Deduplicate and count occurrences to identify the core palette.
4. Group by usage context:
   - **Primary**: main brand color, primary buttons, key interactive elements.
   - **Accent**: secondary brand color, highlights, links.
   - **Surface**: page background, card background, section background.
   - **Text**: heading color, body color, muted/secondary text.
   - **Feedback**: success (green), warning (amber/yellow), danger/error (red), info (blue).
   - **Neutral**: grays used for borders, dividers, disabled states.

### Gradients

- Search for `linear-gradient(`, `radial-gradient(`, `conic-gradient(` in all CSS.
- Extract the full expression including direction/angle and all color stops.
- Classify by usage: text gradient, background gradient, border gradient (via `border-image`).
- Name them semantically (e.g., `gradient-hero`, `gradient-accent`, `gradient-glow`).

### Opacity Variants

- Look for `rgba()` or `hsla()` values with alpha < 1.
- Look for `opacity` property usage on colored elements.
- Map to token names like `primary/10`, `primary/50`, `primary/90`.

---

## Typography

### Font Families

- Scan `<link>` tags pointing to Google Fonts or other CDN font services.
- Scan `@font-face` declarations for locally hosted fonts.
- Scan `@import` rules in CSS for font URLs.
- Extract each family name, weight range, and style (normal/italic).
- Classify: **display** (headings), **primary/body** (body text), **mono** (code).

### Type Scale

Extract from heading elements (h1-h6) and their associated CSS classes:

| Property | CSS Property | Notes |
|---|---|---|
| Font family | `font-family` | Map to font token |
| Size | `font-size` | Record in px and rem |
| Weight | `font-weight` | Numeric (400, 500, 600, 700) |
| Line height | `line-height` | Record in px or unitless ratio |
| Letter spacing | `letter-spacing` | Record in em or px |
| Text transform | `text-transform` | uppercase, capitalize, none |

### Body Variants

Look for classes or elements styled as:
- **body-lg**: larger paragraph text (18-20px typically)
- **body / body-md**: default body text (14-16px typically)
- **body-sm**: small/caption text (12-13px typically)

### Special Text Effects

- **Gradient text**: `background: linear-gradient(...); -webkit-background-clip: text; -webkit-text-fill-color: transparent;`
- **Text shadow glow**: `text-shadow` with colored blur
- **Animated text**: classes that apply keyframe animations to text

---

## Spacing

### Extraction Method

1. Scan all `padding`, `margin`, `gap`, `row-gap`, `column-gap` values across stylesheets.
2. Collect unique values and sort numerically.
3. Identify the base unit (commonly 4px or 8px).
4. Map to a spacing scale:

| Token | Value (4px base) | Value (8px base) |
|---|---|---|
| `space-1` | 0.25rem (4px) | 0.5rem (8px) |
| `space-2` | 0.5rem (8px) | 1rem (16px) |
| `space-3` | 0.75rem (12px) | 1.5rem (24px) |
| `space-4` | 1rem (16px) | 2rem (32px) |
| `space-6` | 1.5rem (24px) | 3rem (48px) |
| `space-8` | 2rem (32px) | 4rem (64px) |
| `space-12` | 3rem (48px) | 6rem (96px) |
| `space-16` | 4rem (64px) | 8rem (128px) |
| `space-24` | 6rem (96px) | 12rem (192px) |

5. Check for CSS custom properties: `--space-*`, `--gap-*`, `--padding-*`.

### Container Widths

- Look for `max-width` on wrapper/container elements.
- Common values: 640px, 768px, 1024px, 1152px, 1280px, 1440px.

---

## Border Radii

### Extraction Method

1. Scan all `border-radius` values in CSS.
2. Deduplicate and sort.
3. Map to semantic tokens:

| Token | Typical Range | Usage |
|---|---|---|
| `radius-sm` | 4-6px | Buttons, badges, small elements |
| `radius-md` | 8-12px | Cards, inputs, medium containers |
| `radius-lg` | 16-20px | Modals, large cards, sections |
| `radius-xl` | 24-32px | Hero elements, feature cards |
| `radius-full` | 9999px | Avatars, pills, circular elements |

4. Check for CSS custom properties: `--radius-*`, `--rounded-*`.

---

## Easing & Transitions

### Easing Functions

- Search for `cubic-bezier(` in all CSS.
- Search for named easings: `ease`, `ease-in`, `ease-out`, `ease-in-out`, `linear`.
- Search for `transition-timing-function` and `animation-timing-function`.
- Map to semantic names:

| Token | Value | Usage |
|---|---|---|
| `ease-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | General transitions |
| `ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Elements exiting |
| `ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Elements entering |
| `ease-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful interactions |

### Transition Durations

- Scan `transition-duration` and `animation-duration` values.
- Common scale:

| Token | Value | Usage |
|---|---|---|
| `duration-fast` | 100-150ms | Micro-interactions, color changes |
| `duration-base` | 200-300ms | Standard transitions |
| `duration-slow` | 400-500ms | Entrance animations, modals |
| `duration-slower` | 600-1000ms | Complex sequences, page transitions |

### Transition Properties

- Note which properties are commonly transitioned: `transform`, `opacity`, `background-color`, `color`, `box-shadow`, `border-color`.

---

## Shadows

### Extraction Method

1. Scan all `box-shadow` values in CSS.
2. Scan `text-shadow` values (less common for tokens).
3. Scan `filter: drop-shadow()` values.
4. Group by visual intensity:

| Token | Characteristics | Usage |
|---|---|---|
| `shadow-sm` | Small offset (0-2px), low blur (4-8px), subtle opacity | Buttons resting state, subtle cards |
| `shadow-md` | Medium offset (2-4px), medium blur (8-16px) | Cards, dropdowns |
| `shadow-lg` | Large offset (4-8px), high blur (16-32px) | Modals, popovers, elevated content |
| `shadow-glow` | Zero offset, colored, high blur (10-30px) | Glow effects on hover, accent elements |

5. Check for CSS custom properties: `--shadow-*`.

---

## Z-Index

### Extraction Method

1. Scan all `z-index` values in CSS.
2. Map to semantic layers:

| Token | Typical Value | Usage |
|---|---|---|
| `z-base` | 0 | Default stacking |
| `z-dropdown` | 10 | Dropdown menus, popovers |
| `z-sticky` | 20 | Sticky headers, fixed nav |
| `z-overlay` | 30 | Overlay backgrounds |
| `z-modal` | 50 | Modal dialogs |
| `z-toast` | 60 | Toast notifications |
| `z-tooltip` | 70 | Tooltips (always on top) |

---

## Breakpoints

### Extraction Method

1. Scan all `@media` queries for `min-width` and `max-width` values.
2. Deduplicate and sort ascending.
3. Common breakpoint scale:

| Token | Value | Label |
|---|---|---|
| `bp-sm` | 640px | Small (large phones) |
| `bp-md` | 768px | Medium (tablets) |
| `bp-lg` | 1024px | Large (laptops) |
| `bp-xl` | 1280px | Extra large (desktops) |
| `bp-2xl` | 1536px | 2X large (wide screens) |

4. Note the responsive strategy: **mobile-first** (`min-width`) or **desktop-first** (`max-width`).

---

## Animations (Keyframes)

### Extraction Method

1. Scan all `@keyframes` blocks — extract name, from/to states, and intermediate steps.
2. Scan `animation` shorthand properties for: name, duration, easing, delay, iteration count, fill mode.
3. Identify trigger mechanism:
   - **CSS-only**: `:hover`, `:focus`, class toggle
   - **JS-driven**: IntersectionObserver adding `.is-visible`, scroll listeners, click handlers
4. Classify by usage:
   - **Entrance**: fade-in, slide-up, reveal, scale-in
   - **Hover**: lift, glow, pulse, scale
   - **Background**: floating particles, gradient shift, parallax
   - **Loading**: spinner, skeleton pulse, shimmer

---

## Output Format

After extraction, tokens should be output in three forms:

1. **CSS custom properties** (`tokens.css`) — the source of truth for runtime.
2. **JSON manifest** (`design-system.manifest.json`) — machine-readable, used by tooling.
3. **Showcase page** — visual documentation using the tokens themselves.

All three must stay in sync. The manifest is the canonical reference that other tools consume.
