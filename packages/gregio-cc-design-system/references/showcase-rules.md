# Design System Showcase Rules

Rules governing the generation of design system showcase pages. There are two modes: **extraction** (from an existing site) and **creative creation** (combining multiple references). Each mode has distinct constraints.

---

## Extraction Mode — Hard Rules (Non-Negotiable)

These rules apply when extracting a design system from an existing website (`/extract-ds`).

### 1. No Redesign, No Invention

- Do NOT redesign or invent new styles.
- Do NOT add CSS properties, classes, or visual treatments that are absent from the source.
- If a style or component is not used in the reference HTML, do NOT include it in the showcase.

### 2. Exact Reuse of Original Assets

- Reuse the EXACT class names found in the source markup.
- Preserve all animations, timing functions, and easing curves verbatim.
- Keep every hover, focus, active, and disabled state exactly as defined.
- Reference the SAME CSS and JS assets used by the original site (link/script tags or inlined code).

### 3. Self-Documenting Structure

- The showcase file must be self-explanatory by structure alone.
- Each section acts as its own documentation block.
- Section headings, subheadings, and labels replace the need for external docs.

### 4. Navigation

- Include a top horizontal nav bar with anchor links to every section.
- Nav must be sticky or fixed so it remains accessible while scrolling.
- Each section must have a matching `id` attribute for anchor linking.

---

## Showcase Sections (Fixed Order)

The showcase page MUST contain these sections in this exact order. Do not reorder, merge, or skip sections (except Icons, which may be omitted when absent).

### Section 0 — Hero (Exact Clone, Text Adapted)

- Must be a direct clone of the original hero section.
- Preserve: HTML structure, class names, layout, images, animations, buttons, backgrounds.
- The ONLY allowed change: replace hero text to present the Design System. Keep similar text length and heading hierarchy.
- **Forbidden**: change layout, spacing, alignment, animations, add elements, remove elements.

### Section 1 — Typography

- Present a spec table with columns: style name, live preview, size/line-height label.
- Live preview must use the exact original CSS classes (no inline styles).
- Display the computed `font-size / line-height` beside each preview (e.g., `40px / 48px`).
- Order: H1, H2, H3, H4, Bold L, Bold M, Bold S, Paragraph, Regular L, Regular M, Regular S.
- Preserve gradient text effects exactly as they appear in the source.

### Section 2 — Colors & Surfaces

- **Backgrounds**: page, section, card, glass/blur variants.
- **Borders & Dividers**: colors, widths, styles.
- **Overlays**: semi-transparent layers, backdrop filters.
- **Gradients**: displayed as swatches with CSS value and usage context.
- Each swatch must show the color value (hex/rgb/hsl) and where it is used.

### Section 3 — UI Components

- Show every component found in the source, grouped by type.
- For each component, display all states side-by-side: default, hover, active, focus, disabled.
- Buttons: all variants found (primary, secondary, ghost, icon, etc.).
- Inputs: only if present in the source. Show default, focus, error, disabled.
- Cards, badges, and other components: same treatment.

### Section 4 — Layout & Spacing

- Document containers, grids, column systems, and section paddings.
- Show 2-3 real layout patterns extracted from the reference site.
- Include visible spacing guides or annotations where possible.
- Demonstrate responsive breakpoints if detectable.

### Section 5 — Motion & Interaction

- **Entrance animations**: fade-in, slide-up, reveal, etc.
- **Hover effects**: lifts, glows, scale transforms.
- **Button transitions**: color, shadow, transform timing.
- **Scroll/reveal**: IntersectionObserver-triggered animations.
- Include a "Motion Gallery" where each animation class is demonstrated independently with its name, duration, and easing labeled.

### Section 6 — Icons

- Use the same icon system, markup, and classes as the source.
- Display all icons found, with their names/identifiers.
- **Omit this entire section if no icons are present in the source.**

---

## Creative Creation Mode Rules

These rules apply when creating a new design system from multiple references (`/create-ds`).

### General Principles

- Creative COMBINATION of multiple reference sources is expected.
- The result should feel cohesive, not like a collage.
- Every token, component, and animation must be intentional and documented.

### Hero Section

- Acts as a demonstration of the DS capabilities.
- Must showcase: images, animations, visual effects, glow, layered backgrounds.
- Should feel impressive and immediately communicate the DS aesthetic.

### Typography

- Complete type system: all families, loading strategy (Google Fonts, local, CDN).
- Full scale: h1 through h6, plus body variants (lg, md, sm).
- Include display/decorative styles if the aesthetic calls for it.

### Colors

- Document every color with: hex, rgb, hsl values.
- Include opacity variants (e.g., primary/10, primary/50).
- Show all gradients with direction, stops, and usage.
- Define semantic roles: primary action, accent, surface, text, feedback states.
- Note contextual usage and contrast intent (light-on-dark, dark-on-light).

### Components

- All components must include their animations as part of the showcase.
- Demonstrate interactive states live, not just as static screenshots.

### Animations

- Reuse animation classes across: backgrounds, entrance transitions, buttons, components.
- Every animation must be named, timed, and eased consistently.

### Backgrounds

- Create elegant, animated background patterns or effects.
- Backgrounds should reinforce the DS aesthetic without overwhelming content.

---

## Quality Checklist

Before considering a showcase complete, verify:

- [ ] All sections present in correct order
- [ ] No invented styles or classes
- [ ] Navigation anchors work for every section
- [ ] Hero is pixel-accurate clone (extraction) or capability demo (creation)
- [ ] Typography table is complete with live previews
- [ ] Color swatches show values and usage
- [ ] Components show all detected states
- [ ] Animations are individually demonstrable
- [ ] Page loads without console errors
- [ ] All external assets (fonts, icons, images) load correctly
