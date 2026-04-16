# React/Next.js Consumption Guide

How React and Next.js projects can consume a design system created by this skill. The DS itself is always generated as Astro or standalone output — this guide covers creating consumption layers for React/Next.js projects.

---

## Strategy Overview

The design system produces CSS custom properties (`tokens.css`) that are framework-agnostic. React/Next.js projects consume them through four complementary approaches:

1. **CSS import** (`tokens.css`) — works everywhere, zero overhead
2. **TypeScript constants** (`tokens.ts`) — autocompletion and type safety
3. **React component wrappers** — typed props mapping to DS classes
4. **Tailwind theme extension** — if the project uses Tailwind CSS

These approaches are additive. A project can use any combination.

---

## 1. CSS Token Import

The simplest integration. Import the token CSS file so custom properties are available globally.

### App Router (Next.js 13+)

```tsx
// app/layout.tsx
import '../styles/design-system/tokens.css';
// Or import the full DS:
import '../styles/design-system/index.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

### Pages Router

```tsx
// pages/_app.tsx
import '../styles/design-system/tokens.css';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
```

### CSS-in-CSS Import

```css
/* styles/globals.css */
@import url('./design-system/tokens.css');
@import url('./design-system/components.css');
```

### Using Tokens in Styles

Once imported, use custom properties anywhere:

```css
.my-component {
  color: var(--ds-primary);
  padding: var(--ds-space-4);
  font-family: var(--ds-font-primary);
  border-radius: var(--ds-radius-md);
}
```

---

## 2. TypeScript Token Constants

Generate a `tokens.ts` file that maps token names to their CSS variable references. Provides autocompletion and type safety without duplicating values.

### Generated File Structure

```typescript
// tokens.ts — auto-generated from design-system.manifest.json

// ── Colors ──────────────────────────────────────────────
export const colors = {
  primary: 'var(--ds-primary)',
  primaryDark: 'var(--ds-primary-dark)',
  primaryLight: 'var(--ds-primary-light)',
  accent: 'var(--ds-accent)',
  accentDark: 'var(--ds-accent-dark)',
  surface: 'var(--ds-surface)',
  surfaceAlt: 'var(--ds-surface-alt)',
  text: 'var(--ds-text)',
  textMuted: 'var(--ds-text-muted)',
  border: 'var(--ds-border)',
  error: 'var(--ds-error)',
  success: 'var(--ds-success)',
  warning: 'var(--ds-warning)',
} as const;

// ── Spacing ─────────────────────────────────────────────
export const spacing = {
  1: 'var(--ds-space-1)',
  2: 'var(--ds-space-2)',
  3: 'var(--ds-space-3)',
  4: 'var(--ds-space-4)',
  6: 'var(--ds-space-6)',
  8: 'var(--ds-space-8)',
  12: 'var(--ds-space-12)',
  16: 'var(--ds-space-16)',
} as const;

// ── Typography ──────────────────────────────────────────
export const fonts = {
  display: 'var(--ds-font-display)',
  primary: 'var(--ds-font-primary)',
  mono: 'var(--ds-font-mono)',
} as const;

export const fontSizes = {
  xs: 'var(--ds-text-xs)',
  sm: 'var(--ds-text-sm)',
  base: 'var(--ds-text-base)',
  lg: 'var(--ds-text-lg)',
  xl: 'var(--ds-text-xl)',
  '2xl': 'var(--ds-text-2xl)',
  '3xl': 'var(--ds-text-3xl)',
  '4xl': 'var(--ds-text-4xl)',
} as const;

// ── Radii ───────────────────────────────────────────────
export const radii = {
  sm: 'var(--ds-radius-sm)',
  md: 'var(--ds-radius-md)',
  lg: 'var(--ds-radius-lg)',
  full: 'var(--ds-radius-full)',
} as const;

// ── Shadows ─────────────────────────────────────────────
export const shadows = {
  sm: 'var(--ds-shadow-sm)',
  md: 'var(--ds-shadow-md)',
  lg: 'var(--ds-shadow-lg)',
} as const;

// ── Type Exports ────────────────────────────────────────
export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type FontToken = keyof typeof fonts;
export type FontSizeToken = keyof typeof fontSizes;
export type RadiusToken = keyof typeof radii;
export type ShadowToken = keyof typeof shadows;
```

### Usage in Components

```tsx
import { colors, spacing } from '@/lib/design-system/tokens';

// Inline styles
<div style={{ color: colors.primary, padding: spacing[4] }}>
  Content
</div>

// With CSS Modules
// Use the CSS variables directly in .module.css files
```

---

## 3. React Component Wrappers

Generate typed React components that map props to DS CSS classes. Components are thin wrappers — all styling lives in the DS CSS, not in JS.

### Button Component

```tsx
// components/ds/Button.tsx
import {
  type ButtonHTMLAttributes,
  type AnchorHTMLAttributes,
  forwardRef,
} from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  loading?: boolean;
}

type ButtonAsButton = ButtonBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> & {
    href?: never;
  };

type ButtonAsLink = ButtonBaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonBaseProps> & {
    href: string;
  };

type ButtonProps = ButtonAsButton | ButtonAsLink;

export const Button = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonProps
>(({ variant = 'primary', size = 'md', loading, className, children, ...rest }, ref) => {
  const classes = [
    'ds-btn',
    `ds-btn-${variant}`,
    `ds-btn-${size}`,
    loading && 'is-loading',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if ('href' in rest && rest.href) {
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={classes}
        {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      className={classes}
      disabled={loading}
      {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  );
});

Button.displayName = 'Button';
```

### Card Component

```tsx
// components/ds/Card.tsx
import { forwardRef, type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'elevated';
  as?: 'div' | 'article' | 'section';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', as: Tag = 'div', className, children, ...rest }, ref) => {
    const classes = [`ds-card`, `ds-card-${variant}`, className]
      .filter(Boolean)
      .join(' ');

    return (
      <Tag ref={ref} className={classes} {...rest}>
        {children}
      </Tag>
    );
  }
);

Card.displayName = 'Card';
```

### Component Generation Pattern

For each component in the manifest:
1. Read `name`, `baseClass`, `variants`, `props` from manifest
2. Generate a TypeScript interface from `props`
3. Map `variants` to union type
4. Build class string from `baseClass` + variant + size + state classes
5. Forward ref and spread remaining HTML attributes
6. Export as named export

---

## 4. Tailwind Theme Extension

If the consuming project uses Tailwind CSS, extend its theme with DS tokens so you can use `text-ds-primary`, `p-ds-4`, etc.

### Config Extension

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'ds-primary': 'var(--ds-primary)',
        'ds-primary-dark': 'var(--ds-primary-dark)',
        'ds-primary-light': 'var(--ds-primary-light)',
        'ds-accent': 'var(--ds-accent)',
        'ds-accent-dark': 'var(--ds-accent-dark)',
        'ds-surface': 'var(--ds-surface)',
        'ds-surface-alt': 'var(--ds-surface-alt)',
        'ds-text': 'var(--ds-text)',
        'ds-text-muted': 'var(--ds-text-muted)',
        'ds-border': 'var(--ds-border)',
      },
      fontFamily: {
        'ds-display': 'var(--ds-font-display)',
        'ds-primary': 'var(--ds-font-primary)',
        'ds-mono': 'var(--ds-font-mono)',
      },
      spacing: {
        'ds-1': 'var(--ds-space-1)',
        'ds-2': 'var(--ds-space-2)',
        'ds-3': 'var(--ds-space-3)',
        'ds-4': 'var(--ds-space-4)',
        'ds-6': 'var(--ds-space-6)',
        'ds-8': 'var(--ds-space-8)',
        'ds-12': 'var(--ds-space-12)',
        'ds-16': 'var(--ds-space-16)',
      },
      borderRadius: {
        'ds-sm': 'var(--ds-radius-sm)',
        'ds-md': 'var(--ds-radius-md)',
        'ds-lg': 'var(--ds-radius-lg)',
      },
      boxShadow: {
        'ds-sm': 'var(--ds-shadow-sm)',
        'ds-md': 'var(--ds-shadow-md)',
        'ds-lg': 'var(--ds-shadow-lg)',
      },
    },
  },
};
```

### Usage with Tailwind

```tsx
<div className="bg-ds-surface text-ds-text p-ds-4 rounded-ds-md shadow-ds-md">
  <h2 className="font-ds-display text-ds-primary">Title</h2>
  <p className="text-ds-text-muted">Description</p>
</div>
```

---

## Next.js Specific Notes

### App Router vs Pages Router

Both work identically for CSS consumption. The only difference is where you place the import:
- **App Router**: `app/layout.tsx`
- **Pages Router**: `pages/_app.tsx`

### Server Components Compatibility

DS components are CSS-based with no JS runtime requirement, so they work in both:
- **Server Components** (default in App Router) — class-based styling works fine
- **Client Components** — needed only if the component has interactive JS (modals, dropdowns)

Mark interactive components with `'use client'`:

```tsx
'use client';
// components/ds/Modal.tsx — needs client-side JS for open/close
```

### File Organization

```
components/
└── ds/
    ├── Button.tsx
    ├── Card.tsx
    ├── Badge.tsx
    ├── Input.tsx
    ├── Modal.tsx
    ├── Nav.tsx
    ├── Hero.tsx
    └── index.ts          # barrel export
lib/
└── design-system/
    ├── tokens.ts         # TypeScript constants
    └── types.ts          # shared DS types
styles/
└── design-system/
    ├── index.css
    ├── tokens.css
    ├── typography.css
    ├── layout.css
    ├── components.css
    └── animations.css
```

### Barrel Export

```typescript
// components/ds/index.ts
export { Button } from './Button';
export { Card } from './Card';
export { Badge } from './Badge';
export { Input } from './Input';
export { Modal } from './Modal';
export { Nav } from './Nav';
export { Hero } from './Hero';
```

---

## Checklist

- [ ] `tokens.css` imported in layout file
- [ ] Custom properties resolve correctly (check in DevTools)
- [ ] `tokens.ts` generated and importable
- [ ] React components render correct CSS classes
- [ ] Type checking passes (`tsc --noEmit`)
- [ ] Tailwind config extended (if applicable)
- [ ] Server/client component boundaries correct
- [ ] All component variants work as expected
