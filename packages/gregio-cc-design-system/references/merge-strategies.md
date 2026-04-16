# Design System Merge Strategies

How to merge multiple design systems or combine with new references. This guide covers conflict resolution, token merging, component deduplication, and post-merge validation.

---

## When to Merge

- **Multi-source extraction**: combining DS output from two or more reference sites
- **Brand integration**: incorporating brand guidelines into an extracted DS
- **Team unification**: merging separate team design systems into one
- **Incremental evolution**: adding new references to an existing DS while preserving established tokens

---

## Token Conflict Resolution

When two design systems define the same token name with different values, apply one of three strategies.

### Strategy: prefer-first (Default)

On name collision, keep the first DS's value. The second DS's conflicting tokens are discarded.

```
DS-A: --ds-primary: #2563eb     ← kept
DS-B: --ds-primary: #e11d48     ← discarded

DS-A: (no --ds-accent)
DS-B: --ds-accent: #f59e0b      ← added (no conflict)
```

**Best for**: updating an existing DS with additions from a second source. The first DS is the authority; the second contributes only what is missing.

### Strategy: prefer-second

On name collision, keep the second DS's value. Effectively a migration path.

```
DS-A: --ds-primary: #2563eb     ← discarded
DS-B: --ds-primary: #e11d48     ← kept
```

**Best for**: migrating to a new design direction where the second source represents the target state.

### Strategy: union

On name collision, keep both. The first retains the original name; the second gets a `-alt` suffix.

```
DS-A: --ds-primary: #2563eb     ← kept as --ds-primary
DS-B: --ds-primary: #e11d48     ← kept as --ds-primary-alt
```

**Best for**: exploratory work, comparing options side by side, or when both palettes should coexist (e.g., light/dark theme seeds).

---

## Component Merge Rules

Components are matched by `name` (from the manifest).

### Case 1: Same Name + Same baseClass

The components are equivalent. Merge them:
- **Variants**: union of both variant lists. If variant names collide, keep the more complete one (more CSS properties).
- **Props**: keep the version with more props defined.
- **Slots/children**: keep the version with more slot definitions.
- **States**: union of all state classes (hover, focus, active, disabled, loading).

```json
// DS-A Button
{ "name": "Button", "baseClass": "ds-btn", "variants": ["primary", "secondary"] }

// DS-B Button
{ "name": "Button", "baseClass": "ds-btn", "variants": ["primary", "ghost", "icon"] }

// Merged Button
{ "name": "Button", "baseClass": "ds-btn", "variants": ["primary", "secondary", "ghost", "icon"] }
```

### Case 2: Same Name + Different baseClass

This is a conflict. The agent should:
1. Warn the user about the conflict
2. Ask which to keep, or whether to rename one
3. If renaming: append source identifier (e.g., `Button` → `ButtonSiteA`, `ButtonSiteB`)

Do NOT silently discard either component.

### Case 3: Different Names

No conflict. Concatenate both into the merged component list.

---

## Animation Merge

Animations are matched by `name` (the `@keyframes` identifier).

### Same Name

Compare the keyframe definitions:

- **Identical keyframes** → deduplicate (keep one copy)
- **Different keyframes** → rename the second with a suffix

```css
/* DS-A */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* DS-B — identical */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
/* Result: keep one copy */

/* DS-B — different */
@keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
/* Result: rename to fadeIn-alt */
```

### Different Names

No conflict. Concatenate.

### Animation Utility Classes

Merge `.reveal-*` and other animation utility classes using the same logic:
- Same class name + same rules → deduplicate
- Same class name + different rules → suffix the second
- Different class names → concatenate

---

## Token Category Merge

Apply the following process for each token category independently: colors, spacing, radii, shadows, typography, z-index, transitions.

### Algorithm

```
for each category (colors, spacing, radii, ...):
  1. Collect all keys from DS-A and DS-B
  2. Build union set of keys
  3. For each key:
     a. Exists only in DS-A → include as-is
     b. Exists only in DS-B → include as-is
     c. Exists in both:
        - Values identical → deduplicate (keep one)
        - Values differ → apply strategy (prefer-first / prefer-second / union)
```

### Value Comparison

When comparing token values:
- Normalize color formats before comparing (`#fff` = `#ffffff` = `rgb(255,255,255)`)
- Normalize spacing units (`16px` = `1rem` at default root font size — flag but treat as different)
- String compare for everything else

---

## Manifest Metadata Merge

The merged manifest's metadata fields are computed as follows:

| Field | Rule |
|-------|------|
| `name` | Concatenate with ` + ` separator. E.g., `"SiteA DS + SiteB DS"` |
| `version` | Reset to `"1.0.0"` |
| `generatedFrom` | Set to `null` (multiple sources) |
| `meta.sources` | Union of all source URLs from both manifests |
| `meta.mergedFrom` | Array of input manifest file paths |
| `meta.mergedAt` | ISO timestamp of merge operation |
| `meta.mergeStrategy` | The strategy used (`"prefer-first"`, `"prefer-second"`, `"union"`) |
| `conventions.prefix` | Must match — see below |
| `conventions.colorFormat` | Use the first DS's format |
| `conventions.spacingScale` | Use the first DS's scale |

### Convention Conflicts

If the two design systems use different conventions (e.g., `ds-` vs `ui-` prefix):

1. **Warn the user** about the mismatch
2. **Ask which prefix** to use for the merged output
3. **Rewrite all class names** in the second DS to match the chosen prefix
4. Do NOT merge with mismatched prefixes silently

---

## CSS File Regeneration

After the manifest merge is complete, regenerate all CSS files from the merged data.

### Regeneration Order

1. **tokens.css** — rebuild from merged token set. All custom property declarations.
2. **typography.css** — rebuild from merged font tokens, heading styles, body text rules.
3. **layout.css** — rebuild from merged spacing tokens, grid definitions, container rules.
4. **components.css** — rebuild from merged component set. All component base classes, variants, states.
5. **animations.css** — rebuild from merged animation set. All `@keyframes` and utility classes.
6. **index.css** — regenerate the aggregator (import order unchanged).

### Showcase Page

Regenerate the showcase page to include all merged components:
- Update the anchor nav to reflect all sections
- Include component variants from both sources
- Update color swatch grid with all merged color tokens
- Update typography specimens if new font families were added

---

## Post-Merge Validation

Run validation on the merged output to catch issues.

### Checks

1. **Orphaned token references** — CSS files reference a `var(--ds-*)` that is not defined in `tokens.css`
2. **Duplicate class names** — two different rule sets with the same selector
3. **Missing required fields** — manifest schema validation (name, version, tokens, components arrays)
4. **Inconsistent conventions** — mixed prefixes in class names
5. **Broken animation references** — `animation-name` references a `@keyframes` that does not exist
6. **Empty variant arrays** — component defined but no variants
7. **Unreferenced tokens** — tokens defined but not used by any component (warning, not error)

### Validation Output

```
[PASS] All token references resolve
[PASS] No duplicate class names
[PASS] Manifest schema valid
[WARN] 3 tokens defined but unreferenced: --ds-warning, --ds-info, --ds-surface-alt
[FAIL] Animation "slideUp" referenced in components.css but not defined in animations.css
```

### Fix Workflow

For each `FAIL`:
1. Identify the source of the broken reference
2. Either add the missing definition or remove the reference
3. Re-validate until all checks pass

For each `WARN`:
- Keep unreferenced tokens (they may be used by consuming projects)
- Log them for the user's awareness

---

## Merge Command Flow

Summary of the full merge process:

```
1. Load manifest A and manifest B
2. Check conventions compatibility (prefix, etc.)
   → If incompatible: warn user, ask for resolution
3. Merge token categories (apply chosen strategy)
4. Merge components (apply component merge rules)
5. Merge animations (deduplicate or suffix)
6. Merge metadata
7. Write merged manifest
8. Regenerate CSS files from merged manifest
9. Regenerate showcase page
10. Run post-merge validation
11. Report results to user
```

---

## Checklist

- [ ] Merge strategy chosen and documented in manifest
- [ ] All token conflicts resolved (no silent overwrites)
- [ ] Component name conflicts resolved (user prompted if needed)
- [ ] Convention mismatches resolved (single prefix in output)
- [ ] CSS files regenerated from merged manifest
- [ ] Showcase page includes all merged components
- [ ] Post-merge validation passes (no FAIL results)
- [ ] `meta.mergedFrom` records input manifest paths
