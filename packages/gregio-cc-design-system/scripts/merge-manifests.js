#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const STRATEGIES = ['prefer-first', 'prefer-second', 'union'];

function parseArgs(argv) {
  const positional = [];
  let strategy = 'prefer-first';
  let out = null;

  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--strategy=')) {
      strategy = arg.slice('--strategy='.length);
      if (!STRATEGIES.includes(strategy)) {
        process.stderr.write(`Unknown strategy "${strategy}". Must be one of: ${STRATEGIES.join(', ')}\n`);
        process.exit(1);
      }
    } else if (arg.startsWith('--out=')) {
      out = arg.slice('--out='.length);
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  if (positional.length < 2) {
    process.stderr.write(
      'Usage: node merge-manifests.js <manifest1.json> <manifest2.json> [--strategy=prefer-first|prefer-second|union] [--out=merged.json]\n',
    );
    process.exit(1);
  }

  return { file1: resolve(positional[0]), file2: resolve(positional[1]), strategy, out: out ? resolve(out) : null };
}

async function readJson(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Deep-merge two manifest objects.
 * Returns { merged, conflicts }.
 */
function deepMerge(a, b, strategy, path = '') {
  const conflicts = [];

  // Both arrays — concatenate and deduplicate
  if (Array.isArray(a) && Array.isArray(b)) {
    const merged = deduplicateArray([...a, ...b]);
    return { merged, conflicts };
  }

  // Both plain objects
  if (isPlainObject(a) && isPlainObject(b)) {
    const merged = { ...a };
    for (const key of Object.keys(b)) {
      const childPath = path ? `${path}.${key}` : key;

      if (!(key in a)) {
        merged[key] = b[key];
        continue;
      }

      // Both children are arrays of objects with "name" field — merge by name
      if (Array.isArray(a[key]) && Array.isArray(b[key]) && hasNamedItems(a[key]) && hasNamedItems(b[key])) {
        const { merged: m, conflicts: c } = mergeNamedArrays(a[key], b[key], strategy, childPath);
        merged[key] = m;
        conflicts.push(...c);
        continue;
      }

      // Both children are arrays — concatenate and deduplicate
      if (Array.isArray(a[key]) && Array.isArray(b[key])) {
        merged[key] = deduplicateArray([...a[key], ...b[key]]);
        continue;
      }

      // Both children are plain objects — recurse
      if (isPlainObject(a[key]) && isPlainObject(b[key])) {
        const { merged: m, conflicts: c } = deepMerge(a[key], b[key], strategy, childPath);
        merged[key] = m;
        conflicts.push(...c);
        continue;
      }

      // Scalar or type mismatch — conflict
      if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
        conflicts.push({
          path: childPath,
          value1: a[key],
          value2: b[key],
          resolution: strategy,
        });
        merged[key] = resolveConflict(a[key], b[key], key, strategy);
      }
      // else identical — keep a[key]
    }
    return { merged, conflicts };
  }

  // Scalar conflict at top level (unlikely but handle it)
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    conflicts.push({ path: path || '<root>', value1: a, value2: b, resolution: strategy });
    return { merged: resolveConflict(a, b, path, strategy), conflicts };
  }

  return { merged: a, conflicts };
}

function resolveConflict(val1, val2, key, strategy) {
  if (strategy === 'prefer-first') return val1;
  if (strategy === 'prefer-second') return val2;
  // union: return both, renaming is only meaningful for named items handled elsewhere
  if (isPlainObject(val1) && isPlainObject(val2)) return { ...val1, ...val2 };
  if (Array.isArray(val1) && Array.isArray(val2)) return deduplicateArray([...val1, ...val2]);
  return val1; // fallback for scalars in union mode — keep first
}

function hasNamedItems(arr) {
  return arr.length > 0 && arr.every((item) => isPlainObject(item) && typeof item.name === 'string');
}

function mergeNamedArrays(arr1, arr2, strategy, path) {
  const conflicts = [];
  const byName = new Map();

  for (const item of arr1) {
    byName.set(item.name, item);
  }

  for (const item of arr2) {
    const existing = byName.get(item.name);
    if (!existing) {
      byName.set(item.name, item);
      continue;
    }

    // Same name — check for conflict
    if (JSON.stringify(existing) !== JSON.stringify(item)) {
      const childPath = `${path}[name="${item.name}"]`;
      conflicts.push({ path: childPath, value1: existing, value2: item, resolution: strategy });

      if (strategy === 'prefer-second') {
        byName.set(item.name, item);
      } else if (strategy === 'union') {
        // Keep both, rename second
        const renamed = { ...item, name: `${item.name}-2` };
        byName.set(renamed.name, renamed);
      }
      // prefer-first: keep existing (already in map)
    }
  }

  return { merged: [...byName.values()], conflicts };
}

function deduplicateArray(arr) {
  const seen = new Set();
  const result = [];
  for (const item of arr) {
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

async function main() {
  const { file1, file2, strategy, out } = parseArgs(process.argv);

  const [manifest1, manifest2] = await Promise.all([readJson(file1), readJson(file2)]);

  const { merged, conflicts } = deepMerge(manifest1, manifest2, strategy);

  const output = JSON.stringify(merged, null, 2) + '\n';

  if (out) {
    await writeFile(out, output, 'utf8');
  } else {
    process.stdout.write(output);
  }

  // Always write conflicts report to stderr
  process.stderr.write(JSON.stringify({ conflicts }, null, 2) + '\n');
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
