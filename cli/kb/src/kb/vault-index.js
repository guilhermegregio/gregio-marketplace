import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from './frontmatter.js';
import { expandPath } from './paths.js';

// Índices do vault regenerados a partir do frontmatter — `kb vault index`.
//
// Escrito à mão, o `_index.md` desanda: casa nova não entra, plano arquivado fica em
// "Ativos". A fonte da verdade é o `_project.md`/`_plan.md` de cada pasta; o índice é
// só a vista. Por isso a regeneração toca SÓ as seções derivadas ("## Lista" de
// 10-projects e "## Ativos" de 30-plans): o texto de abertura e "## Arquivados" (que
// carrega a nota de fechamento de cada plano) são do humano.
//
// Idempotente: mesma entrada no mesmo dia → mesmo texto; arquivo igual não é escrito.

const today = () => new Date().toISOString().slice(0, 10);

function frontmatterOf(file) {
  try {
    return parse(readFileSync(file, 'utf8')).frontmatter ?? {};
  } catch {
    return {};
  }
}

function subdirs(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name)
    .sort((a, b) => a.localeCompare(b));
}

const asArray = v => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]).filter(x => x != null && x !== '');

/** Casas de `<vault>/10-projects`: [{ folder, hasProject, title, status, groups, subfolders }]. */
export function listProjectHouses(vaultRoot) {
  const dir = join(vaultRoot, '10-projects');
  if (!existsSync(dir)) return [];
  return subdirs(dir)
    .filter(name => !name.startsWith('_'))
    .map(folder => {
      const file = join(dir, folder, '_project.md');
      if (!existsSync(file)) return { folder, hasProject: false };
      const fm = frontmatterOf(file);
      return {
        folder,
        hasProject: true,
        title: fm.title || folder,
        status: fm.status || '?',
        groups: asArray(fm.groups),
        subfolders: subdirs(join(dir, folder)),
      };
    });
}

/** Planos ativos de `<vault>/30-plans` (fora de `_archive`): [{ slug, hasPlan, title, status, updated }]. */
export function listActivePlans(vaultRoot) {
  const dir = join(vaultRoot, '30-plans');
  if (!existsSync(dir)) return [];
  return subdirs(dir)
    .filter(name => !name.startsWith('_'))
    .map(slug => {
      const file = join(dir, slug, '_plan.md');
      if (!existsSync(file)) return { slug, hasPlan: false };
      const fm = frontmatterOf(file);
      return { slug, hasPlan: true, title: fm.title || slug, status: fm.status || '?', updated: fm.updated || null, fm };
    });
}

function projectRows(vaultRoot) {
  return listProjectHouses(vaultRoot).map(h => {
    if (!h.hasProject) return `- \`${h.folder}/\` — _(sem \`_project.md\`)_`;
    const groups = h.groups.length ? ` · grupos: ${h.groups.join(', ')}` : '';
    const subs = h.subfolders.length ? ` · ${h.subfolders.join(', ')}` : '';
    return `- [[${h.folder}/_project|${h.title}]] — ${h.status}${groups}${subs}`;
  });
}

function planRows(vaultRoot) {
  return listActivePlans(vaultRoot).map(p => {
    if (!p.hasPlan) return `- \`${p.slug}/\` — _(sem \`_plan.md\`)_`;
    return `- [[${p.slug}/_plan|${p.title}]] — ${p.status}${p.updated ? ` (${p.updated})` : ''}`;
  });
}

// Troca o corpo de uma seção "## <heading>" (até o próximo "## " ou o fim). Se a seção
// não existe, entra antes de `before` (quando houver) ou no fim do arquivo.
function replaceSection(text, heading, rows, { before = null } = {}) {
  const section = rows.length ? `## ${heading}\n\n${rows.join('\n')}\n` : `## ${heading}\n\n`;
  const lines = text.split('\n');
  const start = lines.findIndex(l => l.trim() === `## ${heading}`);
  if (start < 0 && !rows.length) return text; // nada a listar: não inventa seção
  if (start >= 0) {
    let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
    if (end < 0) return `${lines.slice(0, start).join('\n')}\n${section}`;
    return `${lines.slice(0, start).join('\n')}\n${section}\n${lines.slice(end).join('\n')}`;
  }
  const at = before ? lines.findIndex(l => l.trim() === `## ${before}`) : -1;
  if (at >= 0) return `${lines.slice(0, at).join('\n')}\n${section}\n${lines.slice(at).join('\n')}`;
  return `${text.trimEnd()}\n\n${section}`;
}

function bumpUpdated(text) {
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---/);
  if (!m) return text;
  const fm = m[0].replace(/^updated:.*$/m, `updated: ${today()}`);
  return fm + text.slice(m[0].length);
}

/** Texto regenerado de cada índice do vault: [{ file, rel, before, after }]. Não escreve. */
export function planVaultIndex(vaultRoot) {
  const out = [];
  const targets = [
    { rel: '10-projects/_index.md', heading: 'Lista', rows: () => projectRows(vaultRoot) },
    { rel: '30-plans/_index.md', heading: 'Ativos', rows: () => planRows(vaultRoot), before: 'Arquivados' },
  ];
  for (const t of targets) {
    const file = join(vaultRoot, t.rel);
    if (!existsSync(file)) {
      out.push({ file, rel: t.rel, missing: true });
      continue;
    }
    const before = readFileSync(file, 'utf8');
    const regenerated = replaceSection(before, t.heading, t.rows(), { before: t.before });
    // `updated:` só anda quando a seção mudou — senão todo `kb vault index` num dia novo
    // viraria diff em todos os vaults.
    const after = regenerated === before ? before : bumpUpdated(regenerated);
    out.push({ file, rel: t.rel, before, after });
  }
  return out;
}

// Diff de linhas (LCS) — índices são pequenos, O(n·m) basta.
export function lineDiff(a, b) {
  const x = a.split('\n');
  const y = b.split('\n');
  const n = x.length;
  const m = y.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const lines = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push(`- ${x[i++]}`);
    } else {
      lines.push(`+ ${y[j++]}`);
    }
  }
  while (i < n) lines.push(`- ${x[i++]}`);
  while (j < m) lines.push(`+ ${y[j++]}`);
  return lines;
}

/**
 * Regenera os índices de um vault registrado. `dryRun` só devolve o diff.
 * Retorna [{ rel, changed, missing?, diff }].
 */
export async function regenerateVaultIndex(vault, { dryRun = false } = {}) {
  const root = expandPath(vault.path);
  const results = [];
  for (const p of planVaultIndex(root)) {
    if (p.missing) {
      results.push({ rel: p.rel, missing: true, changed: false, diff: [] });
      continue;
    }
    const changed = p.before !== p.after;
    if (changed && !dryRun) await writeFile(p.file, p.after);
    results.push({ rel: p.rel, changed, diff: changed ? lineDiff(p.before, p.after) : [] });
  }
  return results;
}

/** Casas com `_project.md` que o `10-projects/_index.md` não linka (para o `kb map`). */
export function unlistedHouses(vaultRoot) {
  const file = join(vaultRoot, '10-projects', '_index.md');
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  return listProjectHouses(vaultRoot)
    .filter(h => h.hasProject && !text.includes(`[[${h.folder}/_project`))
    .map(h => h.folder);
}
