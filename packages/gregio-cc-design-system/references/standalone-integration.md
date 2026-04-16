# Standalone HTML/CSS/JS Integration Guide

How to generate a standalone design system with no framework dependency. Pure HTML, CSS, and vanilla JavaScript — no build step required.

---

## File Structure

```
<dest-dir>/
├── design-system.html              # Showcase page
├── assets/
│   ├── css/
│   │   ├── index.css               # @import aggregator
│   │   ├── tokens.css              # CSS custom properties
│   │   ├── typography.css
│   │   ├── layout.css
│   │   ├── components.css
│   │   └── animations.css
│   ├── js/
│   │   └── design-system.js        # Vanilla JS behaviors
│   └── snippets/
│       ├── button.html
│       ├── card.html
│       ├── badge.html
│       ├── input.html
│       ├── modal.html
│       ├── nav.html
│       └── hero.html
├── design-system.manifest.json
└── DESIGN_SYSTEM.md
```

---

## HTML Showcase Page

### Document Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Design System — Component Library & Style Guide" />
  <title>Design System</title>

  <!-- Google Fonts (preserve from source) -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

  <!-- Design System CSS -->
  <link rel="stylesheet" href="./assets/css/index.css" />
</head>
<body>

  <!-- Anchor Navigation -->
  <nav class="ds-showcase-nav">
    <a href="#hero">Hero</a>
    <a href="#typography">Typography</a>
    <a href="#colors">Colors</a>
    <a href="#components">Components</a>
    <a href="#layout">Layout</a>
    <a href="#motion">Motion</a>
    <a href="#icons">Icons</a>
  </nav>

  <!-- Sections -->
  <section id="hero">...</section>
  <section id="typography">...</section>
  <section id="colors">...</section>
  <section id="components">...</section>
  <section id="layout">...</section>
  <section id="motion">...</section>
  <section id="icons">...</section>

  <!-- Vanilla JS at bottom -->
  <script src="./assets/js/design-system.js"></script>
</body>
</html>
```

### Key Rules

- Single HTML file, zero build step
- All meta tags present: charset, viewport, description
- Google Fonts links preserved exactly from source `<head>`
- CSS loaded via single `<link>` to `./assets/css/index.css`
- JS loaded via `<script>` at bottom of `<body>`
- Anchor nav at top links to each section by `id`
- All 7 sections present: Hero, Typography, Colors, Components, Layout, Motion, Icons

### Section Content Guidelines

**Hero** — Full-width hero block demonstrating headline treatment, subtitle, CTA buttons.

**Typography** — Specimens for each heading level (h1-h6), body text, small text, labels. Show font family, weight, size, line-height.

**Colors** — Swatch grid for every color token. Each swatch shows the color, its CSS variable name, and hex value.

**Components** — Every component with all variants and states. Group by component type (buttons, cards, badges, inputs, modals).

**Layout** — Grid demonstrations, spacing scale visualization, container widths, breakpoint info.

**Motion** — Interactive demos of each animation class. Scroll-triggered reveals, hover effects, transition examples.

**Icons** — Gallery of all icons used in the DS, with their identifiers.

---

## CSS Aggregator

```css
/* assets/css/index.css */
@import './tokens.css';
@import './typography.css';
@import './layout.css';
@import './components.css';
@import './animations.css';
```

Import order is mandatory. Tokens must load first as all other files reference custom properties.

---

## JavaScript Behaviors

The file `assets/js/design-system.js` contains all interactive behavior with zero dependencies.

### IntersectionObserver (Scroll Reveals)

```javascript
(function () {
  'use strict';

  // Reveal animations on scroll
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  document
    .querySelectorAll('.reveal-up, .reveal-zoom, .reveal-left, .reveal-right')
    .forEach((el) => revealObserver.observe(el));
})();
```

### Modal Close

```javascript
// Modal close via [data-modal-close] buttons
document.querySelectorAll('[data-modal-close]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const dialog = btn.closest('dialog');
    if (dialog) dialog.close();
  });
});

// Close modal on backdrop click
document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
});
```

### Character Reveal Animation

```javascript
// Split .char-reveal text into individual spans with --char-index
document.querySelectorAll('.char-reveal').forEach((el) => {
  const text = el.textContent;
  el.textContent = '';
  [...text].forEach((char, i) => {
    const span = document.createElement('span');
    span.textContent = char === ' ' ? '\u00A0' : char;
    span.style.setProperty('--char-index', i);
    span.classList.add('char');
    el.appendChild(span);
  });
});
```

### Full File Template

Combine all behaviors into a single IIFE:

```javascript
// assets/js/design-system.js
(function () {
  'use strict';

  // --- Reveal on Scroll ---
  const revealObserver = new IntersectionObserver(/* ... */);
  document.querySelectorAll('.reveal-up, .reveal-zoom, .reveal-left, .reveal-right')
    .forEach((el) => revealObserver.observe(el));

  // --- Modal Close ---
  document.querySelectorAll('[data-modal-close]').forEach(/* ... */);
  document.querySelectorAll('dialog').forEach(/* ... */);

  // --- Char Reveal ---
  document.querySelectorAll('.char-reveal').forEach(/* ... */);
})();
```

---

## Snippets

Each file in `assets/snippets/` is a standalone, copy-paste-ready HTML fragment.

### Format

```html
<!-- assets/snippets/button.html -->

<!-- Primary Button -->
<button class="ds-btn ds-btn-primary ds-btn-md">
  Get Started
</button>

<!-- Secondary Button -->
<button class="ds-btn ds-btn-secondary ds-btn-md">
  Learn More
</button>

<!-- Ghost Button -->
<button class="ds-btn ds-btn-ghost ds-btn-md">
  Cancel
</button>

<!-- Icon Button -->
<button class="ds-btn ds-btn-icon" aria-label="Menu">
  <svg><!-- icon SVG --></svg>
</button>

<!-- Small Button -->
<button class="ds-btn ds-btn-primary ds-btn-sm">
  Small
</button>

<!-- Large Button -->
<button class="ds-btn ds-btn-primary ds-btn-lg">
  Large
</button>

<!-- Loading State -->
<button class="ds-btn ds-btn-primary ds-btn-md is-loading" disabled>
  Loading...
</button>

<!-- Button as Link -->
<a href="#" class="ds-btn ds-btn-primary ds-btn-md">
  Link Button
</a>
```

### Snippet Rules

- One HTML file per component
- Include ALL variants and states as separate examples
- Each example has a comment label above it
- No framework syntax — pure HTML
- Include necessary `aria-*` attributes
- Self-contained: can be dropped into any HTML page that loads the DS CSS

---

## Serving Locally

No build step needed. Use any static file server:

```bash
# Python
python3 -m http.server 8080

# Node.js (npx)
npx serve .

# PHP
php -S localhost:8080
```

Then open `http://localhost:8080/design-system.html`.

---

## Using in Other Projects

### Step 1: Copy CSS

Copy the `assets/css/` directory into your project.

### Step 2: Import CSS

```html
<!-- In your HTML -->
<link rel="stylesheet" href="path/to/design-system/css/index.css" />
```

Or in a build tool:

```css
/* In your main CSS file */
@import 'path/to/design-system/css/index.css';
```

### Step 3: Use Classes

Apply `ds-*` classes in your markup. Use snippets as starting points:

```html
<button class="ds-btn ds-btn-primary ds-btn-md">Click Me</button>

<div class="ds-card ds-card-elevated">
  <div class="ds-card-body">
    <h3>Title</h3>
    <p>Content here.</p>
  </div>
</div>
```

### Step 4: Add JS (Optional)

If your project uses reveal animations or modals, include the JS file:

```html
<script src="path/to/design-system/js/design-system.js"></script>
```

Or copy specific behavior blocks into your own JS.

---

## Checklist

- [ ] `design-system.html` opens correctly in a browser
- [ ] All 7 sections are present and populated
- [ ] CSS loads without 404 errors (check DevTools Network tab)
- [ ] JS behaviors work: scroll reveals, modal close, char-reveal
- [ ] Every component variant is shown in the showcase
- [ ] Snippets are copy-paste functional (test one in a blank HTML file)
- [ ] Google Fonts load correctly
- [ ] Page is responsive (test at 375px, 768px, 1280px widths)
- [ ] No console errors
