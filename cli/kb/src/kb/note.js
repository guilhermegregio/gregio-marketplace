import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Faixa de diacríticos combinantes (U+0300–U+036F), construída por código
// para não depender de caracteres combinantes literais no source.
const COMBINING = new RegExp('[\\u0300-\\u036f]', 'g');

// Slug estável a partir de um texto livre.
export function slugify(text) {
  return (
    (text || 'untitled')
      .toString()
      .normalize('NFKD')
      .replace(COMBINING, '') // remove acentos combinantes
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'untitled'
  );
}

// ID determinístico no formato <vault>-<categoria>-<slug>.
export function noteId(vaultName, category, title) {
  return `${slugify(vaultName)}-${slugify(category)}-${slugify(title)}`;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

// Resolve um caminho de arquivo livre de colisão (acrescenta -2, -3, ...).
export function uniquePath(dir, base, ext = '.md') {
  let candidate = join(dir, `${base}${ext}`);
  let n = 2;
  while (existsSync(candidate)) {
    candidate = join(dir, `${base}-${n}${ext}`);
    n++;
  }
  return candidate;
}

// Monta o frontmatter conforme o contrato da KB, com defaults sensatos.
export function buildFrontmatter({
  vaultName,
  type,
  category,
  title,
  status,
  projects = [],
  groups = [],
  stack = [],
  tags = [],
  visibility,
  sourceUrl = null,
}) {
  const day = today();
  const fm = {
    id: noteId(vaultName, category ?? type, title),
    type,
    title,
    status: status ?? (category === 'idea' ? 'idea' : 'active'),
    projects,
    groups,
    stack,
    tags,
    visibility,
    created: day,
    updated: day,
  };
  if (sourceUrl) fm.source_url = sourceUrl;
  return fm;
}
