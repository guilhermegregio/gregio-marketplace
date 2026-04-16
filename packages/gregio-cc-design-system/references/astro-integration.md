# Astro Integration Guide

How to integrate an extracted or created design system into an Astro project. The DS skill produces CSS files and a manifest — this guide covers turning those into Astro components and pages.

---

## File Structure

```
src/
├── pages/
│   └── design-system.astro        # Showcase page
├── components/ds/
│   ├── Button.astro
│   ├── Card.astro
│   ├── Badge.astro
│   ├── Input.astro
│   ├── Modal.astro
│   ├── Nav.astro
│   └── Hero.astro
└── styles/design-system/
    ├── index.css                   # @import aggregator
    ├── tokens.css                  # CSS custom properties
    ├── typography.css
    ├── layout.css
    ├── components.css
    └── animations.css
```

---

## CSS Import Strategy

### Import Order

The aggregator file `index.css` must import in this exact order:

```css
/* src/styles/design-system/index.css */
@import './tokens.css';
@import './typography.css';
@import './layout.css';
@import './components.css';
@import './animations.css';
```

Order matters because:
- `tokens.css` defines custom properties used by everything else
- `typography.css` uses token values for font families, sizes, weights
- `layout.css` uses spacing tokens
- `components.css` depends on all of the above
- `animations.css` is standalone but loaded last for override ability

### Adding to the Project

Option A — Global import in BaseLayout:

```astro
---
// src/layouts/BaseLayout.astro
---
<html>
  <head>
    <style is:global>
      @import '../styles/design-system/index.css';
    </style>
  </head>
  <body><slot /></body>
</html>
```

Option B — Import in a global CSS file already referenced by the layout:

```css
/* src/styles/global.css */
@import './design-system/index.css';
/* ... other global styles */
```

### Coexistence with Tailwind

If the Astro project uses Tailwind CSS:
- Token custom properties (`--ds-primary`, `--ds-space-1`, etc.) work alongside Tailwind utilities
- No class name conflicts if the DS uses a `ds-` prefix convention
- Tailwind's `@layer` can be used to control specificity if needed
- Consider extending `tailwind.config` with DS tokens (see react-next-consumption.md)

---

## Component Format

Every Astro DS component follows this pattern:

```astro
---
// src/components/ds/Button.astro
interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  icon?: string;
  loading?: boolean;
  class?: string;
}

const {
  variant = 'primary',
  size = 'md',
  href,
  icon,
  loading = false,
  class: className,
  ...rest
} = Astro.props;

const Tag = href ? 'a' : 'button';
const classes = [
  'ds-btn',
  `ds-btn-${variant}`,
  `ds-btn-${size}`,
  loading && 'is-loading',
  className,
].filter(Boolean).join(' ');
---

<Tag
  class={classes}
  href={href}
  disabled={loading && !href}
  {...rest}
>
  {icon && <span class="ds-btn-icon" set:html={icon} />}
  <slot />
</Tag>
```

### Key Conventions

1. **TypeScript props interface** at the top of frontmatter — always define the shape.
2. **Flexible element rendering** — components that can be links or buttons check for `href`.
3. **Slot-based composition** — use `<slot />` for children, named slots for complex layouts.
4. **Class merging** — accept a `class` prop and merge it with internal classes.
5. **Spread rest props** — forward unknown attributes (`aria-*`, `data-*`, `id`, etc.).
6. **Boolean class toggling** — use array + filter pattern for conditional classes.

### Card Example (Compound Component)

```astro
---
interface Props {
  variant?: 'default' | 'glass' | 'elevated';
  href?: string;
  class?: string;
}

const { variant = 'default', href, class: className, ...rest } = Astro.props;
const Tag = href ? 'a' : 'div';
const classes = [`ds-card`, `ds-card-${variant}`, className].filter(Boolean).join(' ');
---

<Tag class={classes} href={href} {...rest}>
  <div class="ds-card-media">
    <slot name="media" />
  </div>
  <div class="ds-card-body">
    <slot />
  </div>
  <div class="ds-card-footer">
    <slot name="footer" />
  </div>
</Tag>
```

---

## Icon Integration

### With astro-icon (Preferred)

If the project has `astro-icon` installed:

```astro
---
import { Icon } from 'astro-icon/components';
---
<button class="ds-btn ds-btn-icon">
  <Icon name="solar:arrow-right-bold" />
</button>
```

### With Iconify (Inline SVG)

If using iconify directly:

```html
<span class="ds-icon" data-icon="solar:arrow-right-bold"></span>
```

Add the iconify loader script in the layout `<head>`:

```html
<script src="https://code.iconify.design/3/3.1.0/iconify.min.js"></script>
```

### Preserving Source Icons

When extracting from a reference site:
- Keep the original icon system (Font Awesome, Material Icons, custom SVGs, etc.)
- Do not swap icon libraries — preserve what the source uses
- Copy inline SVGs verbatim into component templates

---

## Showcase Page

The showcase page (`src/pages/design-system.astro`) demonstrates all DS components.

### Structure

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Button from '../components/ds/Button.astro';
import Card from '../components/ds/Card.astro';
import Badge from '../components/ds/Badge.astro';
import Input from '../components/ds/Input.astro';
import Modal from '../components/ds/Modal.astro';
import Nav from '../components/ds/Nav.astro';
import Hero from '../components/ds/Hero.astro';
---

<BaseLayout title="Design System">
  <Nav />

  <!-- Anchor navigation -->
  <nav class="ds-showcase-nav">
    <a href="#hero">Hero</a>
    <a href="#typography">Typography</a>
    <a href="#colors">Colors</a>
    <a href="#components">Components</a>
    <a href="#layout">Layout</a>
    <a href="#motion">Motion</a>
    <a href="#icons">Icons</a>
  </nav>

  <section id="hero">
    <Hero title="Design System" subtitle="Component Library" />
  </section>

  <section id="typography"><!-- Typography specimens --></section>
  <section id="colors"><!-- Color swatches from tokens --></section>
  <section id="components">
    <Button>Primary</Button>
    <Button variant="secondary">Secondary</Button>
    <Card><p>Card content</p></Card>
    <!-- All component variants -->
  </section>
  <section id="layout"><!-- Grid/spacing demos --></section>
  <section id="motion"><!-- Animation examples --></section>
  <section id="icons"><!-- Icon gallery --></section>
</BaseLayout>

<script>
  // IntersectionObserver for reveal animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal-up, .reveal-zoom, .reveal-left, .reveal-right')
    .forEach(el => observer.observe(el));

  // Modal close handlers
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('dialog')?.close();
    });
  });
</script>
```

### Guidelines

- Import all DS components at the top of frontmatter
- Use `BaseLayout` if the project has one; otherwise create a minimal HTML wrapper
- Each section gets an `id` for anchor navigation
- Show every variant and state of each component
- Inline `<script>` at the bottom for interactivity (IntersectionObserver, modal handlers)
- No external JS dependencies in the showcase

---

## Package Integration

### Dependencies

If the DS needs packages not yet in the project:

```bash
# Icon support
pnpm add astro-icon @iconify-json/solar

# If DS uses view transitions
# (already built into Astro, just enable in config)
```

### Astro Config Updates

```javascript
// astro.config.mjs — only modify if needed
import { defineConfig } from 'astro/config';
import icon from 'astro-icon';

export default defineConfig({
  integrations: [
    icon(), // only if using astro-icon
  ],
});
```

### Dev Server

```bash
pnpm dev
# Open http://localhost:4321/design-system
```

### Build Verification

```bash
pnpm build
# Check dist/ for correct CSS bundling and asset paths
```

---

## Checklist

Before considering the integration complete:

- [ ] All CSS files are in `src/styles/design-system/`
- [ ] `index.css` imports files in correct order
- [ ] Global CSS import is wired into the layout
- [ ] Each component has TypeScript props interface
- [ ] Components use slots for composition
- [ ] Showcase page renders all components with all variants
- [ ] IntersectionObserver script works for reveal animations
- [ ] Modal open/close functionality works
- [ ] No console errors in dev server
- [ ] Icons render correctly (whichever system is used)
