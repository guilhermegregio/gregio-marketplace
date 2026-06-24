// Frontmatter YAML — subconjunto nativo (sem deps externas).
// Suporta o contrato da KB: chaves planas, escalares (string/number/bool/null),
// arrays inline ([a, b]) e arrays em bloco (- item). Sem nesting profundo.

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseScalar(raw) {
  let s = raw.trim();
  // Comentário inline YAML (espaço + #) em escalar NÃO citado.
  if (!(s.startsWith('"') || s.startsWith("'"))) {
    const c = s.match(/\s+#/);
    if (c) s = s.slice(0, c.index).trim();
  }
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d*\.\d+$/.test(s)) return parseFloat(s);
  return s;
}

function parseInlineArray(raw) {
  const inner = raw.trim().slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map(x => parseScalar(x));
}

// Divide o conteúdo em { frontmatter: object|null, body: string }.
export function parse(text) {
  const m = text.match(FM_RE);
  if (!m) return { frontmatter: null, body: text };
  const yaml = m[1];
  const body = text.slice(m[0].length);
  const data = {};
  const lines = yaml.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const kv = line.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const rest = kv[2];
    if (rest.trim().startsWith('[')) {
      data[key] = parseInlineArray(rest);
    } else if (rest.trim() === '') {
      // Pode ser array em bloco nas linhas seguintes.
      const arr = [];
      let j = i + 1;
      while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
        arr.push(parseScalar(lines[j].replace(/^\s*-\s+/, '')));
        j++;
      }
      if (arr.length) {
        data[key] = arr;
        i = j - 1;
      } else {
        data[key] = null;
      }
    } else {
      data[key] = parseScalar(rest);
    }
  }
  return { frontmatter: data, body };
}

function needsQuote(s) {
  return /[:#\[\]{}",&*!|>%@`]/.test(s) || /^\s|\s$/.test(s) || s === '';
}

function serializeScalar(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  const s = String(v);
  return needsQuote(s) ? JSON.stringify(s) : s;
}

export function stringify(frontmatter, body = '') {
  const lines = ['---'];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      const items = value.map(v => serializeScalar(v)).join(', ');
      lines.push(`${key}: [${items}]`);
    } else {
      lines.push(`${key}: ${serializeScalar(value)}`);
    }
  }
  lines.push('---');
  const out = lines.join('\n') + '\n';
  return body ? `${out}\n${body.replace(/^\n+/, '')}` : out;
}

// Mescla frontmatter novo sobre o existente do texto e devolve o documento.
export function merge(text, patch) {
  const { frontmatter, body } = parse(text);
  const next = { ...(frontmatter ?? {}), ...patch };
  return stringify(next, body);
}
