#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function parseArgs(argv) {
  const positional = [];
  for (const arg of argv.slice(2)) {
    if (!arg.startsWith('-')) positional.push(arg);
  }
  if (positional.length < 1) {
    process.stderr.write('Usage: node validate-manifest.js <manifest.json>\n');
    process.exit(1);
  }
  return { file: resolve(positional[0]) };
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Collect all token names from every token category.
 * Returns a Set of strings like "primary", "sans", "4", etc.
 */
function collectTokenNames(tokens) {
  const names = new Set();
  if (!isPlainObject(tokens)) return names;
  for (const category of Object.values(tokens)) {
    if (isPlainObject(category)) {
      for (const key of Object.keys(category)) names.add(key);
    }
  }
  return names;
}

/**
 * Check whether a string looks like a token reference.
 * Matches patterns like {colors.primary}, var(--color-primary), or bare token names
 * found as values in component props that point to known token keys.
 */
function extractTokenRefs(value) {
  const refs = new Set();
  if (typeof value !== 'string') return refs;
  // {category.name} placeholders
  const braceRe = /\{(\w+)\.(\w+)\}/g;
  let m;
  while ((m = braceRe.exec(value)) !== null) refs.add(m[2]);
  // var(--prefix-name) CSS custom properties
  const varRe = /var\(--[\w-]*?-(\w+)\)/g;
  while ((m = varRe.exec(value)) !== null) refs.add(m[1]);
  return refs;
}

function validate(manifest) {
  const errors = [];
  const warnings = [];

  // --- Required top-level fields ---
  const requiredTopLevel = ['name', 'version', 'tokens', 'components'];
  for (const field of requiredTopLevel) {
    if (manifest[field] === undefined || manifest[field] === null) {
      errors.push({ path: field, message: `missing required field "${field}"` });
    }
  }

  // --- tokens checks ---
  const tokens = manifest.tokens;
  if (isPlainObject(tokens)) {
    const requiredTokenCategories = ['colors', 'fonts'];
    for (const cat of requiredTokenCategories) {
      if (!tokens[cat] || (isPlainObject(tokens[cat]) && Object.keys(tokens[cat]).length === 0)) {
        errors.push({ path: `tokens.${cat}`, message: `missing required token category "${cat}"` });
      }
    }
  }

  // --- components checks ---
  const components = manifest.components;
  if (Array.isArray(components)) {
    const tokenNames = collectTokenNames(tokens);

    for (let i = 0; i < components.length; i++) {
      const comp = components[i];
      const prefix = `components[${i}]`;

      if (!comp.name) {
        errors.push({ path: prefix, message: 'component missing required field "name"' });
      }
      if (!comp.baseClass) {
        errors.push({ path: comp.name ? `components[${i}](${comp.name})` : prefix, message: 'component missing required field "baseClass"' });
      }

      // a11y warning
      if (!comp.a11y) {
        warnings.push({ path: comp.name ? `components[${i}](${comp.name})` : prefix, message: 'no accessibility info' });
      }

      // orphaned token references
      if (tokenNames.size > 0) {
        const compStr = JSON.stringify(comp);
        const refs = extractTokenRefs(compStr);
        for (const ref of refs) {
          if (!tokenNames.has(ref)) {
            warnings.push({
              path: comp.name ? `components[${i}](${comp.name})` : prefix,
              message: `references non-existent token "${ref}"`,
            });
          }
        }
      }
    }
  } else if (manifest.components !== undefined && !Array.isArray(manifest.components)) {
    errors.push({ path: 'components', message: '"components" should be an array' });
  }

  // --- conventions ---
  if (manifest.conventions === undefined || manifest.conventions === null) {
    warnings.push({ path: 'conventions', message: 'missing "conventions" field' });
  }

  // --- stats ---
  let tokenCount = 0;
  if (isPlainObject(tokens)) {
    for (const cat of Object.values(tokens)) {
      if (isPlainObject(cat)) tokenCount += Object.keys(cat).length;
      else if (Array.isArray(cat)) tokenCount += cat.length;
    }
  }
  const componentCount = Array.isArray(components) ? components.length : 0;
  const animationCount = Array.isArray(manifest.animations) ? manifest.animations.length : 0;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: { tokenCount, componentCount, animationCount },
  };
}

async function main() {
  const { file } = parseArgs(process.argv);
  const raw = await readFile(file, 'utf8');
  const manifest = JSON.parse(raw);
  const result = validate(manifest);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.valid) process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
