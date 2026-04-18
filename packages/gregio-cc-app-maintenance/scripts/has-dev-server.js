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
  const pkg = await readJson(join(root, 'package.json'));
  if (!pkg) return { hasDevServer: false, reason: 'no package.json' };

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const scripts = pkg.scripts ?? {};

  const frameworkMap = {
    'next': { default: 'dev', port: 3000 },
    'astro': { default: 'dev', port: 4321 },
    'vite': { default: 'dev', port: 5173 },
    'react-scripts': { default: 'start', port: 3000 },
    'nuxt': { default: 'dev', port: 3000 },
    '@remix-run/dev': { default: 'dev', port: 3000 },
    '@sveltejs/kit': { default: 'dev', port: 5173 },
  };

  const matched = Object.keys(frameworkMap).find(f => deps[f]);
  if (!matched) return { hasDevServer: false, reason: 'no web framework in deps' };

  const { default: preferredScript, port } = frameworkMap[matched];
  const script = scripts[preferredScript] ? preferredScript
    : scripts.dev ? 'dev'
    : scripts.start ? 'start'
    : null;

  if (!script) return { hasDevServer: false, reason: `framework ${matched} found but no dev/start script` };

  return { hasDevServer: true, framework: matched, script, port, command: `pnpm ${script}` };
}

const [, , targetDir = process.cwd()] = process.argv;
detect(targetDir)
  .then((r) => { process.stdout.write(JSON.stringify(r, null, 2) + '\n'); })
  .catch((err) => { console.error(err.message); process.exit(1); });
