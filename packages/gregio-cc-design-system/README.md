# gregio-cc-design-system

Complete design system workbench for Claude Code. Extract from websites, create from scratch, improve, merge, and generate components/pages for Astro, React/Next, or standalone HTML.

## Skills

| Command | Description |
|---------|-------------|
| `/fetch-site <url>` | Download a website locally for analysis |
| `/extract-ds <url-or-path> [dest]` | Extract DS from website/HTML into modular source-of-truth |
| `/create-ds [dest]` | Create a new DS from scratch with references/preferences |
| `/improve-ds [dir]` | Improve, audit, or extend an existing DS |
| `/merge-ds <ds1> <ds2> [dest]` | Merge multiple design systems |
| `/generate-from-ds <what>` | Generate components/pages using DS as source of truth |
| `ds-conventions` | Auto-triggers when `design-system.manifest.json` is present |

## What Gets Generated

### Files
- **CSS Modules**: `tokens.css`, `typography.css`, `layout.css`, `components.css`, `animations.css`
- **Showcase Page**: `design-system.astro` or `design-system.html`
- **Components**: Astro `.astro` files or standalone HTML snippets
- **Manifest**: `design-system.manifest.json` (machine-readable inventory)
- **Guide**: `DESIGN_SYSTEM.md` (human + agent readable)

### Output Modes
- **Astro**: typed components, CSS imports, showcase page at `/design-system`
- **Standalone**: pure HTML/CSS/JS, zero dependencies, copy-paste snippets
- **React/Next exports** (optional): `tokens.ts` + typed component wrappers

## Architecture

```
gregio-cc-design-system/
├── skills/          7 SKILL.md files (the commands above)
├── references/      8 markdown guides (loaded on-demand by skills)
├── templates/       Astro, standalone, and shared templates
└── scripts/         Node.js utilities (zero permanent deps, via npx)
```

### Scripts
- `fetch-site.js` — orchestrates cheerio (static) + playwright (SPA) fetching
- `cheerio-fetch.js` — fast static HTML extraction
- `playwright-fetch.js` — headless browser for SPAs
- `detect-stack.js` — detects Astro/React/Next/Vue/Tailwind
- `merge-manifests.js` — deep merge two manifest JSONs
- `validate-manifest.js` — validate manifest schema

All scripts use only Node.js built-in modules. Runtime deps (cheerio, playwright) are resolved via `npx --yes --package=...` — nothing is installed permanently.

## Quick Start

```bash
# 1. Download a site
/fetch-site https://example.com

# 2. Extract design system
/extract-ds ./ds-fetch/example-com ./my-project

# 3. Improve it
/improve-ds ./my-project --audit

# 4. Generate pages from it
/generate-from-ds "landing page with hero and pricing"
```

## Requirements

- Node.js >= 20
- Claude Code with plugin support
- Chromium (auto-installed via playwright on first SPA fetch)

## Author

Guilherme Gregio <guilherme@gregio.net>
