#!/usr/bin/env node
import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function readJson(p) {
  try { return JSON.parse(await readFile(p, 'utf8')); } catch { return null; }
}

async function readText(p) {
  try { return await readFile(p, 'utf8'); } catch { return null; }
}

// --- semver-ish compare (only MAJOR.MINOR.PATCH, ignores prerelease tags) ---
function parseVer(v) {
  const m = String(v ?? '').match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function gte(a, b) {
  const x = parseVer(a), y = parseVer(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) {
    if (x[i] > y[i]) return true;
    if (x[i] < y[i]) return false;
  }
  return true;
}

// --- pnpm-workspace.yaml: regex readers for top-level keys (no yaml dep) ---
// Only top-level scalars/blocks are inspected; this matches the limited policy
// surface and keeps the script dependency-free (yq is used only for writes).
function getTopScalar(yaml, key) {
  if (!yaml) return undefined;
  const re = new RegExp(`^${key}:[ \\t]*(.+?)[ \\t]*$`, 'm');
  const m = yaml.match(re);
  if (!m) return undefined;
  let raw = m[1].trim();
  // strip surrounding quotes
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
    raw = raw.slice(1, -1);
  }
  return raw;
}

// true when `key:` exists as a top-level block with at least one indented child
function hasNonEmptyBlock(yaml, key) {
  if (!yaml) return false;
  const lines = yaml.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(new RegExp(`^${key}:[ \\t]*(.*)$`));
    if (!m) continue;
    const inline = m[1].trim();
    // inline map/sequence, e.g. `allowBuilds: {a: true}` or `[x]`
    if (inline && inline !== '{}' && inline !== '[]') return true;
    // otherwise look for an indented child on following lines
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === '') continue;
      return /^[ \t]+\S/.test(lines[j]);
    }
    return false;
  }
  return false;
}

function asBool(raw) {
  if (raw === undefined) return undefined;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}

async function detectPnpmVersion(pkg, root) {
  const pm = pkg?.packageManager;
  if (typeof pm === 'string' && pm.startsWith('pnpm@')) {
    return pm.slice('pnpm@'.length);
  }
  try {
    const out = execFileSync('pnpm', ['--version'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim() || null;
  } catch {
    return null;
  }
}

const DESIRED_MIN_RELEASE_AGE = 10080; // 7 days in minutes
const MIN_PNPM_FOR_RELEASE_AGE = '10.16.0';

async function audit(dir) {
  const root = resolve(dir);
  const pkg = await readJson(join(root, 'package.json'));

  // package manager
  const hasPnpmLock = await exists(join(root, 'pnpm-lock.yaml'));
  let pkgManager = null;
  if (hasPnpmLock) pkgManager = 'pnpm';
  else if (await exists(join(root, 'yarn.lock'))) pkgManager = 'yarn';
  else if (await exists(join(root, 'bun.lockb'))) pkgManager = 'bun';
  else if (await exists(join(root, 'package-lock.json'))) pkgManager = 'npm';
  else if (pkg?.packageManager?.startsWith('pnpm')) pkgManager = 'pnpm';

  const isPnpm = pkgManager === 'pnpm';
  const pnpmVersion = isPnpm ? await detectPnpmVersion(pkg, root) : null;

  // pnpm >= 11 keeps settings in pnpm-workspace.yaml (camelCase);
  // .npmrc is auth/registry only. Older pnpm / npm use .npmrc (kebab).
  const pnpm11Plus = isPnpm && gte(pnpmVersion ?? '0.0.0', '11.0.0');
  const targetFile = pnpm11Plus ? 'pnpm-workspace.yaml' : '.npmrc';
  const keyStyle = pnpm11Plus ? 'camel' : 'kebab';
  const supportsMinReleaseAge = isPnpm && gte(pnpmVersion ?? '0.0.0', MIN_PNPM_FOR_RELEASE_AGE);
  const supportsBlockExotic = isPnpm; // pnpm-only setting

  // current config sources
  const npmrcText = await readText(join(root, '.npmrc'));
  const yamlText = await readText(join(root, 'pnpm-workspace.yaml'))
    ?? await readText(join(root, 'pnpm-workspace.yml'));

  // derive private scopes from scoped registries in .npmrc
  const scopedRegistries = [];
  if (npmrcText) {
    for (const m of npmrcText.matchAll(/^(@[^:#\s]+):registry=/gm)) {
      if (!scopedRegistries.includes(m[1])) scopedRegistries.push(m[1]);
    }
  }

  // build allowlist present? (pnpm 11 yaml `allowBuilds`, or pnpm.onlyBuiltDependencies)
  const yamlAllowBuilds = hasNonEmptyBlock(yamlText, 'allowBuilds');
  const obd = pkg?.pnpm?.onlyBuiltDependencies;
  const pkgAllowlist = Array.isArray(obd) && obd.length > 0;
  const hasBuildAllowlist = yamlAllowBuilds || pkgAllowlist;

  // ---- current values ----
  const cur = {};
  if (pnpm11Plus) {
    cur.minimumReleaseAge = getTopScalar(yamlText, 'minimumReleaseAge');
    cur.minimumReleaseAgeExclude = hasNonEmptyBlock(yamlText, 'minimumReleaseAgeExclude');
    cur.savePrefix = getTopScalar(yamlText, 'savePrefix');
    cur.ignoreScripts = asBool(getTopScalar(yamlText, 'ignoreScripts'));
    cur.blockExoticSubdeps = asBool(getTopScalar(yamlText, 'blockExoticSubdeps'));
  } else if (npmrcText) {
    cur.minimumReleaseAge = getNpmrc(npmrcText, 'minimum-release-age');
    cur.saveExact = asBool(getNpmrc(npmrcText, 'save-exact'));
    cur.ignoreScripts = asBool(getNpmrc(npmrcText, 'ignore-scripts'));
  }

  // ---- desired policy + findings ----
  // `edit` is a tool-agnostic snippet: the literal line(s) to ensure present in
  // `targetFile`. SKILL.md applies it with the Edit tool (insert if the key is
  // absent, replace the value if present). No yq/jq dependency — works the same
  // regardless of which yq flavor (if any) is installed.
  const findings = [];
  const yamlScalar = (key, val) => `${key}: ${val}`;
  const yamlSeq = (key, items) => `${key}:\n${items.map((i) => `  - "${i}"`).join('\n')}`;
  const npmrcLine = (key, val) => `${key}=${val}`;

  // 1. minimum release age
  if (supportsMinReleaseAge) {
    const n = cur.minimumReleaseAge !== undefined ? Number(cur.minimumReleaseAge) : undefined;
    const status = n === undefined ? 'missing' : (n >= DESIRED_MIN_RELEASE_AGE ? 'ok' : 'weak');
    findings.push({
      key: pnpm11Plus ? 'minimumReleaseAge' : 'minimum-release-age',
      intent: 'Atrasar instalação de versões recém-publicadas (mín. 7 dias)',
      current: n === undefined ? `(não setado — default ${isPnpm ? '1440 = 1 dia' : 'nenhum'})` : `${n} min`,
      desired: `${DESIRED_MIN_RELEASE_AGE} min (7 dias)`,
      status,
      edit: pnpm11Plus ? yamlScalar('minimumReleaseAge', DESIRED_MIN_RELEASE_AGE) : npmrcLine('minimum-release-age', DESIRED_MIN_RELEASE_AGE),
    });

    // exclude private scopes so internal publishes are not delayed
    if (scopedRegistries.length) {
      const patterns = scopedRegistries.map((s) => `${s}/*`);
      const present = pnpm11Plus ? cur.minimumReleaseAgeExclude : false;
      findings.push({
        key: 'minimumReleaseAgeExclude',
        intent: 'Não atrasar publicações internas (scopes privados)',
        current: present ? '(setado — verificar conteúdo)' : '(não setado)',
        desired: JSON.stringify(patterns),
        status: present ? 'ok' : 'missing',
        optional: true,
        // only meaningful in pnpm 11 yaml; for npmrc pnpm reads it too as comma list
        edit: pnpm11Plus
          ? yamlSeq('minimumReleaseAgeExclude', patterns)
          : npmrcLine('minimum-release-age-exclude', patterns.join(',')),
      });
    }
  } else if (isPnpm) {
    findings.push({
      key: 'minimumReleaseAge',
      intent: 'Atrasar instalação de versões recém-publicadas (mín. 7 dias)',
      current: `pnpm ${pnpmVersion ?? '?'} não suporta`,
      desired: `requer pnpm >= ${MIN_PNPM_FOR_RELEASE_AGE}`,
      status: 'unsupported',
      note: 'Suba o pnpm para habilitar minimumReleaseAge.',
    });
  }

  // 2. ignore install/lifecycle scripts (adaptive)
  if (hasBuildAllowlist) {
    findings.push({
      key: pnpm11Plus ? 'ignoreScripts' : 'ignore-scripts',
      intent: 'Bloquear scripts maliciosos de dependências',
      current: 'allowlist ativo (deny-by-default)',
      desired: 'manter allowlist',
      status: 'ok',
      note: 'O repo já usa allowlist (allowBuilds/onlyBuiltDependencies): scripts de deps são bloqueados por padrão. ignoreScripts: true NÃO é recomendado aqui — quebraria builds nativos allowlistados (ex: sharp, swc).',
    });
  } else {
    const v = cur.ignoreScripts;
    findings.push({
      key: pnpm11Plus ? 'ignoreScripts' : 'ignore-scripts',
      intent: 'Bloquear scripts de install/lifecycle de dependências',
      current: v === undefined ? '(não setado — default: scripts rodam)' : String(v),
      desired: 'true',
      status: v === true ? 'ok' : 'missing',
      edit: pnpm11Plus ? yamlScalar('ignoreScripts', 'true') : npmrcLine('ignore-scripts', 'true'),
    });
  }

  // 3. exact versions (no ^ / ~)
  if (pnpm11Plus) {
    const sp = cur.savePrefix;
    const status = sp === undefined ? 'missing' : (sp === '' ? 'ok' : 'weak');
    findings.push({
      key: 'savePrefix',
      intent: 'Pinar versões exatas (sem ^ / ~)',
      current: sp === undefined ? "(não setado — default '^')" : `'${sp}'`,
      desired: "'' (exact)",
      status,
      edit: yamlScalar('savePrefix', '""'),
    });
  } else {
    const se = cur.saveExact;
    findings.push({
      key: 'save-exact',
      intent: 'Pinar versões exatas (sem ^ / ~)',
      current: se === undefined ? '(não setado)' : String(se),
      desired: 'true',
      status: se === true ? 'ok' : 'missing',
      edit: npmrcLine('save-exact', 'true'),
    });
  }

  // 4. block exotic (git/tarball) transitive deps — pnpm only, default true
  if (supportsBlockExotic) {
    const be = cur.blockExoticSubdeps;
    // default is true; only flag if explicitly disabled
    const status = be === false ? 'weak' : 'ok';
    findings.push({
      key: 'blockExoticSubdeps',
      intent: 'Bloquear deps git/tarball transitivas (não confiáveis)',
      current: be === undefined ? '(não setado — default true)' : String(be),
      desired: 'true',
      status,
      optional: be !== false, // hardening only if not explicitly broken
      edit: pnpm11Plus ? yamlScalar('blockExoticSubdeps', 'true') : npmrcLine('block-exotic-subdeps', 'true'),
      note: 'pnpm não bloqueia deps git DIRETAS; isto cobre apenas as transitivas.',
    });
  }

  // `optional` findings are hardening/convenience (e.g. exclude lists, defaults
  // already protecting) — they are offered but do not make the repo "not ok".
  const blocking = findings.filter((f) => !f.optional && (f.status === 'missing' || f.status === 'weak'));
  const optional = findings.filter((f) => f.optional && (f.status === 'missing' || f.status === 'weak'));
  const allOk = blocking.length === 0;

  return {
    root,
    pkgManager,
    pnpmVersion,
    targetFile,
    keyStyle,
    supportsMinReleaseAge,
    hasBuildAllowlist,
    scopedRegistries,
    allOk,
    blockingCount: blocking.length,
    optionalCount: optional.length,
    findings,
  };
}

function getNpmrc(text, key) {
  const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=(.+?)\\s*$`, 'm');
  const m = text.match(re);
  return m ? m[1].trim() : undefined;
}

const [, , targetDir = process.cwd()] = process.argv;
audit(targetDir)
  .then((r) => { process.stdout.write(JSON.stringify(r, null, 2) + '\n'); })
  .catch((err) => { console.error(err.message); process.exit(1); });
