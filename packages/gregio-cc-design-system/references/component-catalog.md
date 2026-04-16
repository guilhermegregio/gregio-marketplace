# Component Catalog

Complete catalog of all recognized design system components. Each entry defines the component's purpose, CSS classes, variants, states, typed props, accessibility requirements, and a minimal HTML example using the `ds-` prefix convention.

---

## 1. Button

**Description**: Primary interactive element for actions and navigation.

**Base class**: `.ds-btn`

**Variants**:
- `.ds-btn-primary` — Main call-to-action. Solid background, high contrast.
- `.ds-btn-secondary` — Secondary actions. Outlined or muted fill.
- `.ds-btn-ghost` — Tertiary/text actions. Transparent background, text color only.
- `.ds-btn-icon` — Icon-only button. Square aspect ratio.
- `.ds-btn-accent` — Accent-colored CTA. Gradient or accent fill.

**States**: default, hover, active, focus, disabled, loading

**Props**:
| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'icon' \| 'accent'` | `'primary'` | Visual variant |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `icon` | `string \| null` | `null` | Icon name (displayed before label) |
| `href` | `string \| null` | `null` | If set, renders as `<a>` instead of `<button>` |
| `disabled` | `boolean` | `false` | Disables interaction |
| `loading` | `boolean` | `false` | Shows spinner, disables interaction |

**A11y**: `role="button"`, `focus-visible` outline, min target 44x44px, `aria-disabled` when disabled, `aria-busy` when loading.

```html
<button class="ds-btn ds-btn-primary">Get Started</button>
<button class="ds-btn ds-btn-secondary ds-btn-sm">Learn More</button>
<button class="ds-btn ds-btn-ghost" disabled>Disabled</button>
<button class="ds-btn ds-btn-icon" aria-label="Menu">
  <svg><!-- icon --></svg>
</button>
```

---

## 2. Card

**Description**: Content container with optional visual treatments.

**Base class**: `.ds-card`

**Variants**:
- `.ds-card-default` — Standard card with surface background and shadow.
- `.ds-card-product` — Product display with image area, title, price.
- `.ds-card-glass` — Glassmorphism: translucent background, backdrop blur.
- `.ds-card-flashlight` — Mouse-tracking glow effect on hover.
- `.ds-card-feature` — Feature highlight with icon, title, description.

**States**: default, hover

**Props**:
| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `'default' \| 'product' \| 'glass' \| 'flashlight' \| 'feature'` | `'default'` | Visual variant |
| `padding` | `'sm' \| 'md' \| 'lg'` | `'md'` | Internal padding |

**A11y**: Use semantic markup inside (`<article>`, headings). Cards that are fully clickable need `<a>` wrapping or `role="link"`.

```html
<div class="ds-card ds-card-glass">
  <h3 class="ds-h4">Feature Title</h3>
  <p class="ds-body">Description of the feature.</p>
</div>
```

---

## 3. Badge

**Description**: Small status indicator or label, typically inline.

**Base class**: `.ds-badge`

**Variants**:
- `.ds-badge-default` — Neutral/gray background.
- `.ds-badge-label` — Uppercase, smaller text.
- `.ds-badge-primary` — Primary color background.
- `.ds-badge-accent` — Accent color background.

**States**: default

**Props**:
| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `'default' \| 'label' \| 'primary' \| 'accent'` | `'default'` | Visual variant |
| `dot` | `boolean` | `false` | Prepends a small colored dot |

**A11y**: Use `<span>` or `<mark>`. If conveying status, add `aria-label` for screen readers.

```html
<span class="ds-badge ds-badge-primary">New</span>
<span class="ds-badge ds-badge-accent ds-badge-dot">Live</span>
```

---

## 4. Input

**Description**: Form input field with label and validation support.

**Base class**: `.ds-input`

**Variants**:
- `.ds-input-text` — Standard text input.
- `.ds-input-email` — Email input with validation.
- `.ds-input-password` — Password with optional toggle.
- `.ds-input-search` — Search input with icon.

**States**: default, focus, error, disabled

**Props**:
| Prop | Type | Default | Description |
|---|---|---|---|
| `type` | `'text' \| 'email' \| 'password' \| 'search'` | `'text'` | Input type |
| `name` | `string` | — | Form field name (required) |
| `label` | `string` | — | Visible label text (required) |
| `placeholder` | `string \| null` | `null` | Placeholder text |
| `error` | `string \| null` | `null` | Error message (triggers error state) |
| `required` | `boolean` | `false` | Marks field as required |

**A11y**: Always pair with `<label>` via `for`/`id`. Use `aria-describedby` for error messages. `aria-invalid="true"` on error state. `aria-required` when required.

```html
<div class="ds-input-group">
  <label class="ds-label" for="email">Email</label>
  <input class="ds-input ds-input-email" type="email" id="email" name="email"
         placeholder="you@example.com" required aria-required="true">
  <span class="ds-input-error" aria-live="polite">Please enter a valid email</span>
</div>
```

---

## 5. Modal

**Description**: Overlay dialog for focused content or actions.

**Base class**: `.ds-modal`

**Sizes**: `.ds-modal-sm` (400px), `.ds-modal-md` (560px), `.ds-modal-lg` (720px)

**States**: open, closing

**Props**:
| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | — | Unique identifier (required) |
| `title` | `string` | — | Modal heading (required) |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Width preset |

**A11y**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to title. Focus trap: Tab cycles within modal. ESC closes. Return focus to trigger element on close.

```html
<div class="ds-modal ds-modal-md" role="dialog" aria-modal="true"
     aria-labelledby="modal-title" id="confirm-modal">
  <div class="ds-modal-backdrop"></div>
  <div class="ds-modal-content">
    <h2 class="ds-h3" id="modal-title">Confirm Action</h2>
    <p class="ds-body">Are you sure you want to proceed?</p>
    <div class="ds-modal-actions">
      <button class="ds-btn ds-btn-ghost" data-close>Cancel</button>
      <button class="ds-btn ds-btn-primary">Confirm</button>
    </div>
  </div>
</div>
```

---

## 6. Nav

**Description**: Top navigation bar with logo, links, and optional actions.

**Base class**: `.ds-nav`

**Props**:
| Prop | Type | Default | Description |
|---|---|---|---|
| `logoSrc` | `string` | — | Logo image source (required) |
| `logoAlt` | `string` | — | Logo alt text (required) |
| `links` | `Array<{label: string, href: string}>` | `[]` | Navigation links |

**Behavior**: Sticky positioning, backdrop blur on scroll. Hamburger menu on mobile.

**A11y**: `<nav>` element with `aria-label="Main navigation"`. Mobile toggle: `aria-expanded`, `aria-controls`.

```html
<nav class="ds-nav" aria-label="Main navigation">
  <a class="ds-nav-logo" href="/">
    <img src="/logo.svg" alt="Brand Name">
  </a>
  <ul class="ds-nav-links">
    <li><a href="#features">Features</a></li>
    <li><a href="#pricing">Pricing</a></li>
  </ul>
  <button class="ds-nav-toggle" aria-expanded="false" aria-controls="nav-menu">
    <span class="ds-sr-only">Menu</span>
  </button>
</nav>
```

---

## 7. Hero

**Description**: Full-width introductory section, typically the first visible content.

**Base class**: `.ds-hero`

**Props**:
| Prop | Type | Default | Description |
|---|---|---|---|
| `eyebrow` | `string \| null` | `null` | Small text above the title |
| `title` | `string` | — | Main heading (required) |
| `subtitle` | `string \| null` | `null` | Supporting text below title |

**Slots**: `cta` (action buttons area), `decoration` (background visuals, images, effects).

```html
<section class="ds-hero">
  <div class="ds-container">
    <span class="ds-badge ds-badge-label">New Release</span>
    <h1 class="ds-h1">Build Something Amazing</h1>
    <p class="ds-body-lg">A modern design system for rapid development.</p>
    <div class="ds-hero-cta">
      <a class="ds-btn ds-btn-primary ds-btn-lg" href="#start">Get Started</a>
      <a class="ds-btn ds-btn-ghost ds-btn-lg" href="#docs">Documentation</a>
    </div>
  </div>
  <div class="ds-hero-decoration"><!-- background effects --></div>
</section>
```

---

## 8. Table

**Description**: Data table with optional styling variants.

**Base class**: `.ds-table`

**Variants**:
- `.ds-table-default` — Standard table with borders.
- `.ds-table-striped` — Alternating row backgrounds.
- `.ds-table-compact` — Reduced padding for dense data.

**Props**:
| Prop | Type | Default | Description |
|---|---|---|---|
| `columns` | `Array<{key: string, label: string}>` | — | Column definitions (required) |
| `data` | `Array<Record<string, any>>` | — | Row data (required) |

**A11y**: Use `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`. Add `aria-sort` on sortable columns.

```html
<table class="ds-table ds-table-striped">
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Status</th>
      <th scope="col">Price</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Product A</td>
      <td><span class="ds-badge ds-badge-primary">Active</span></td>
      <td>$29.99</td>
    </tr>
  </tbody>
</table>
```

---

## 9. Accordion

**Description**: Expandable/collapsible content sections.

**Base class**: `.ds-accordion`

**Props**:
| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `Array<{title: string, content: string}>` | — | Accordion items (required) |
| `multiple` | `boolean` | `false` | Allow multiple panels open simultaneously |

**A11y**: `<button>` triggers with `aria-expanded`, `aria-controls`. Content panels have `role="region"` and `aria-labelledby`.

```html
<div class="ds-accordion">
  <div class="ds-accordion-item">
    <button class="ds-accordion-trigger" aria-expanded="false"
            aria-controls="panel-1" id="trigger-1">
      What is included?
    </button>
    <div class="ds-accordion-panel" role="region"
         aria-labelledby="trigger-1" id="panel-1" hidden>
      <p class="ds-body">Full access to all components and tokens.</p>
    </div>
  </div>
</div>
```

---

## 10. Tabs

**Description**: Tabbed content panels for switching between views.

**Base class**: `.ds-tabs`

**Props**:
| Prop | Type | Default | Description |
|---|---|---|---|
| `tabs` | `Array<{label: string, content: string}>` | — | Tab definitions (required) |
| `defaultTab` | `number` | `0` | Index of initially active tab |

**A11y**: `role="tablist"` on container, `role="tab"` on triggers, `role="tabpanel"` on panels. `aria-selected` on active tab. Arrow key navigation between tabs.

```html
<div class="ds-tabs">
  <div class="ds-tabs-list" role="tablist">
    <button class="ds-tab" role="tab" aria-selected="true"
            aria-controls="tab-panel-0" id="tab-0">Overview</button>
    <button class="ds-tab" role="tab" aria-selected="false"
            aria-controls="tab-panel-1" id="tab-1">Details</button>
  </div>
  <div class="ds-tab-panel" role="tabpanel" aria-labelledby="tab-0"
       id="tab-panel-0">
    <p class="ds-body">Overview content here.</p>
  </div>
  <div class="ds-tab-panel" role="tabpanel" aria-labelledby="tab-1"
       id="tab-panel-1" hidden>
    <p class="ds-body">Details content here.</p>
  </div>
</div>
```

---

## 11. Toast

**Description**: Temporary notification message that auto-dismisses.

**Base class**: `.ds-toast`

**Variants**:
- `.ds-toast-success` — Green, checkmark icon.
- `.ds-toast-error` — Red, error icon.
- `.ds-toast-warning` — Amber, warning icon.
- `.ds-toast-info` — Blue, info icon.

**Props**:
| Prop | Type | Default | Description |
|---|---|---|---|
| `message` | `string` | — | Notification text (required) |
| `duration` | `number` | `5000` | Auto-dismiss time in ms |
| `position` | `'top-right' \| 'top-center' \| 'bottom-right' \| 'bottom-center'` | `'top-right'` | Screen position |

**A11y**: `role="alert"`, `aria-live="polite"` (info) or `aria-live="assertive"` (error). Dismiss button with `aria-label`.

```html
<div class="ds-toast ds-toast-success" role="alert" aria-live="polite">
  <span class="ds-toast-icon"><!-- checkmark --></span>
  <span class="ds-toast-message">Changes saved successfully.</span>
  <button class="ds-toast-close" aria-label="Dismiss notification">&times;</button>
</div>
```

---

## 12. Tooltip

**Description**: Small informational popup triggered by hover or focus.

**Base class**: `.ds-tooltip`

**Props**:
| Prop | Type | Default | Description |
|---|---|---|---|
| `content` | `string` | — | Tooltip text (required) |
| `position` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'top'` | Tooltip placement |
| `trigger` | `'hover' \| 'click'` | `'hover'` | Activation method |

**A11y**: Use `aria-describedby` on the trigger pointing to the tooltip `id`. Tooltip must be focusable or triggered on focus for keyboard users. `role="tooltip"` on the popup.

```html
<span class="ds-tooltip-wrapper">
  <button class="ds-btn ds-btn-icon" aria-describedby="tip-1">
    <svg><!-- info icon --></svg>
  </button>
  <span class="ds-tooltip ds-tooltip-top" role="tooltip" id="tip-1">
    More information about this feature.
  </span>
</span>
```

---

## 13. Dropdown

**Description**: Toggleable menu of options or actions.

**Base class**: `.ds-dropdown`

**Props**:
| Prop | Type | Default | Description |
|---|---|---|---|
| `trigger` | `string` | — | Trigger button label (required) |
| `items` | `Array<{label: string, href?: string, action?: string}>` | — | Menu items (required) |
| `position` | `'bottom-start' \| 'bottom-end'` | `'bottom-start'` | Menu placement |

**A11y**: `role="menu"` on the list, `role="menuitem"` on each item. `aria-haspopup="true"` and `aria-expanded` on trigger. Arrow key navigation. ESC closes.

```html
<div class="ds-dropdown">
  <button class="ds-btn ds-btn-secondary" aria-haspopup="true" aria-expanded="false">
    Options
  </button>
  <ul class="ds-dropdown-menu" role="menu">
    <li><a class="ds-dropdown-item" role="menuitem" href="#edit">Edit</a></li>
    <li><a class="ds-dropdown-item" role="menuitem" href="#duplicate">Duplicate</a></li>
    <li><hr class="ds-dropdown-divider"></li>
    <li><button class="ds-dropdown-item ds-dropdown-item-danger"
                role="menuitem">Delete</button></li>
  </ul>
</div>
```

---

## 14. Footer

**Description**: Page footer with link columns and copyright.

**Base class**: `.ds-footer`

**Props**:
| Prop | Type | Default | Description |
|---|---|---|---|
| `columns` | `Array<{title: string, links: Array<{label: string, href: string}>}>` | — | Link columns (required) |
| `copyright` | `string` | — | Copyright text (required) |

**A11y**: Use `<footer>` element. Link groups wrapped in `<nav>` with `aria-label`.

```html
<footer class="ds-footer">
  <div class="ds-container ds-footer-grid">
    <nav class="ds-footer-column" aria-label="Product links">
      <h4 class="ds-footer-title">Product</h4>
      <ul class="ds-footer-links">
        <li><a href="#features">Features</a></li>
        <li><a href="#pricing">Pricing</a></li>
      </ul>
    </nav>
    <nav class="ds-footer-column" aria-label="Company links">
      <h4 class="ds-footer-title">Company</h4>
      <ul class="ds-footer-links">
        <li><a href="#about">About</a></li>
        <li><a href="#careers">Careers</a></li>
      </ul>
    </nav>
  </div>
  <div class="ds-footer-bottom">
    <p class="ds-body-sm">&copy; 2026 Brand Name. All rights reserved.</p>
  </div>
</footer>
```

---

## 15. Sidebar

**Description**: Vertical navigation panel, collapsible on desktop, drawer on mobile.

**Base class**: `.ds-sidebar`

**Props**:
| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `Array<{label: string, href: string, icon?: string, active?: boolean}>` | — | Nav items (required) |
| `collapsed` | `boolean` | `false` | Show icons only (collapsed state) |

**Behavior**: On desktop, sidebar can toggle between expanded and collapsed (icon-only). On mobile, it becomes an off-canvas drawer triggered by a hamburger button.

**A11y**: `<aside>` with `<nav aria-label="Sidebar">`. Active item marked with `aria-current="page"`. Mobile drawer: focus trap when open, ESC to close.

```html
<aside class="ds-sidebar">
  <nav aria-label="Sidebar navigation">
    <ul class="ds-sidebar-items">
      <li>
        <a class="ds-sidebar-item ds-sidebar-item-active" href="/dashboard"
           aria-current="page">
          <svg class="ds-sidebar-icon"><!-- icon --></svg>
          <span class="ds-sidebar-label">Dashboard</span>
        </a>
      </li>
      <li>
        <a class="ds-sidebar-item" href="/settings">
          <svg class="ds-sidebar-icon"><!-- icon --></svg>
          <span class="ds-sidebar-label">Settings</span>
        </a>
      </li>
    </ul>
  </nav>
</aside>
```

---

## 16. Pagination

**Description**: Page navigation for paginated content.

**Base class**: `.ds-pagination`

**Props**:
| Prop | Type | Default | Description |
|---|---|---|---|
| `total` | `number` | — | Total number of items (required) |
| `current` | `number` | `1` | Current page number |
| `perPage` | `number` | `10` | Items per page |

**A11y**: Wrap in `<nav aria-label="Pagination">`. Current page: `aria-current="page"`. Disabled prev/next: `aria-disabled="true"`. Each link should have `aria-label="Page N"`.

```html
<nav class="ds-pagination" aria-label="Pagination">
  <a class="ds-pagination-prev" href="#" aria-disabled="true">Previous</a>
  <ol class="ds-pagination-pages">
    <li><a class="ds-pagination-page ds-pagination-page-active"
           href="?page=1" aria-current="page" aria-label="Page 1">1</a></li>
    <li><a class="ds-pagination-page" href="?page=2" aria-label="Page 2">2</a></li>
    <li><a class="ds-pagination-page" href="?page=3" aria-label="Page 3">3</a></li>
    <li><span class="ds-pagination-ellipsis">...</span></li>
    <li><a class="ds-pagination-page" href="?page=12" aria-label="Page 12">12</a></li>
  </ol>
  <a class="ds-pagination-next" href="?page=2">Next</a>
</nav>
```

---

## Class Naming Convention

All components follow these rules:

- **Prefix**: `ds-` for all classes.
- **Component**: `ds-{component}` (e.g., `ds-btn`, `ds-card`).
- **Variant**: `ds-{component}-{variant}` (e.g., `ds-btn-primary`).
- **Size**: `ds-{component}-{size}` (e.g., `ds-btn-sm`).
- **State**: `ds-{component}-{state}` or pseudo-class (e.g., `ds-input-error`, `:hover`).
- **Sub-element**: `ds-{component}-{element}` (e.g., `ds-modal-content`, `ds-nav-links`).
- **Utility**: `ds-sr-only` (screen reader only), `ds-container`, `ds-grid-2`, `ds-grid-3`.
