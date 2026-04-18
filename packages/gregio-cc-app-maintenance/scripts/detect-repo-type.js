#!/usr/bin/env node
import { readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function readJson(p) {
  try { return JSON.parse(await readFile(p, 'utf8')); } catch { return null; }
}

async function detect(dir) {
  const root = resolve(dir);

  const hasNxJson = await exists(join(root, 'nx.json'));
  const hasPnpmWorkspace = await exists(join(root, 'pnpm-workspace.yaml'))
    || await exists(join(root, 'pnpm-workspace.yml'));
  const hasPnpmLock = await exists(join(root, 'pnpm-lock.yaml'));
  const pkg = await readJson(join(root, 'package.json'));

  // Package manager detection
  let pkgManager = null;
  if (hasPnpmLock) pkgManager = 'pnpm';
  else if (await exists(join(root, 'yarn.lock'))) pkgManager = 'yarn';
  else if (await exists(join(root, 'bun.lockb'))) pkgManager = 'bun';
  else if (await exists(join(root, 'package-lock.json'))) pkgManager = 'npm';

  // Type selection — priority: nx > pnpm-workspace > pnpm-simple > unknown
  let type = 'unknown';
  if (hasNxJson) type = 'nx';
  else if (hasPnpmWorkspace) type = 'pnpm-workspace';
  else if (pkg) type = 'pnpm-simple';

  // pnpm-specific signals (only meaningful for pnpm-based projects)
  const pnpmConfig = pkg?.pnpm ?? {};
  const hasOverrides = Boolean(pnpmConfig.overrides && Object.keys(pnpmConfig.overrides).length);
  const hasPatches = Boolean(pnpmConfig.patchedDependencies && Object.keys(pnpmConfig.patchedDependencies).length);
  const overrides = hasOverrides ? Object.keys(pnpmConfig.overrides) : [];
  const patches = hasPatches ? Object.keys(pnpmConfig.patchedDependencies) : [];

  // Nx version consistency check (all @nx/* must share the same version)
  let nxVersionMismatch = null;
  if (type === 'nx' && pkg) {
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const nxDeps = Object.entries(allDeps).filter(([name]) => name === 'nx' || name.startsWith('@nx/'));
    const versions = new Set(nxDeps.map(([, v]) => v));
    if (versions.size > 1) {
      nxVersionMismatch = Object.fromEntries(nxDeps);
    }
  }

  // Dev server heuristic — a web framework + `dev` or `start` script
  const deps = pkg ? { ...pkg.dependencies, ...pkg.devDependencies } : {};
  const scripts = pkg?.scripts ?? {};
  const webFrameworks = ['next', 'astro', 'vite', 'react-scripts', 'nuxt', '@remix-run/dev', '@sveltejs/kit'];
  const hasWebFramework = webFrameworks.some(f => deps[f]);
  const hasDevScript = Boolean(scripts.dev || scripts.start);
  const hasDevServer = hasWebFramework && hasDevScript;

  return {
    type,
    root,
    pkgManager,
    hasPackageJson: Boolean(pkg),
    hasPnpmWorkspace,
    hasNxJson,
    hasOverrides,
    hasPatches,
    overrides,
    patches,
    nxVersionMismatch,
    hasDevServer,
    scripts: Object.keys(scripts),
  };
}

const [, , targetDir = process.cwd()] = process.argv;
detect(targetDir)
  .then((r) => { process.stdout.write(JSON.stringify(r, null, 2) + '\n'); })
  .catch((err) => { console.error(err.message); process.exit(1); });
