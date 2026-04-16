#!/usr/bin/env node
import { readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function readJson(p) {
  try { return JSON.parse(await readFile(p, 'utf8')); } catch { return null; }
}

async function detectStack(dir) {
  const root = resolve(dir);

  const astroConfigs = ['astro.config.mjs', 'astro.config.ts', 'astro.config.js'];
  let hasAstroConfig = false;
  for (const name of astroConfigs) {
    if (await exists(join(root, name))) { hasAstroConfig = true; break; }
  }

  const pkg = await readJson(join(root, 'package.json'));
  const deps = pkg ? { ...pkg.dependencies, ...pkg.devDependencies } : {};

  const astroVersion = deps.astro ?? null;
  const tailwindVersion = deps['@tailwindcss/vite'] ?? deps.tailwindcss ?? null;

  // React / Next.js detection
  const reactVersion = deps.react ?? null;
  const nextVersion = deps.next ?? null;
  const hasNextConfig = await exists(join(root, 'next.config.js'))
    || await exists(join(root, 'next.config.mjs'))
    || await exists(join(root, 'next.config.ts'));

  // Vue / Nuxt detection
  const vueVersion = deps.vue ?? null;
  const nuxtVersion = deps.nuxt ?? null;

  let pkgManager = null;
  if (await exists(join(root, 'pnpm-lock.yaml'))) pkgManager = 'pnpm';
  else if (await exists(join(root, 'yarn.lock'))) pkgManager = 'yarn';
  else if (await exists(join(root, 'bun.lockb'))) pkgManager = 'bun';
  else if (await exists(join(root, 'package-lock.json'))) pkgManager = 'npm';

  const hasClaudeMd = await exists(join(root, 'CLAUDE.md'));
  const hasDesignSystem = await exists(join(root, 'design-system.manifest.json'));

  return {
    hasAstro: hasAstroConfig || Boolean(astroVersion),
    astroVersion,
    hasTailwind: Boolean(tailwindVersion),
    tailwindVersion,
    hasReact: Boolean(reactVersion),
    reactVersion,
    hasNext: hasNextConfig || Boolean(nextVersion),
    nextVersion,
    hasVue: Boolean(vueVersion),
    vueVersion,
    hasNuxt: Boolean(nuxtVersion),
    nuxtVersion,
    hasPackageJson: Boolean(pkg),
    pkgManager,
    hasClaudeMd,
    hasDesignSystem,
    root,
  };
}

const [, , targetDir = process.cwd()] = process.argv;
detectStack(targetDir)
  .then((r) => { process.stdout.write(JSON.stringify(r, null, 2) + '\n'); })
  .catch((err) => { console.error(err.message); process.exit(1); });
