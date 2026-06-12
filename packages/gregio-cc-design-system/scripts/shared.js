import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export function findNpxNodeModules() {
  const paths = (process.env.PATH || '').split(':');
  for (const p of paths) {
    if (p.includes('/_npx/') && p.endsWith('/.bin')) {
      return p.replace(/\/\.bin$/, '');
    }
  }
  return null;
}

export function loadOptional(name) {
  try { return require(name); } catch {}
  const npxNm = findNpxNodeModules();
  if (npxNm) {
    try {
      const r = createRequire(npxNm + '/__resolver.js');
      return r(name);
    } catch {}
  }
  return null;
}

export function log(msg) { process.stdout.write(`[crawl-site] ${msg}\n`); }
export function warn(msg) { process.stderr.write(`[crawl-site] ${msg}\n`); }

export function kindFromContentType(ct = '', url = '') {
  if (ct.includes('text/html')) return 'html';
  if (ct.includes('text/css') || /\.css(\?|$)/i.test(url)) return 'css';
  if (ct.includes('javascript') || /\.m?js(\?|$)/i.test(url)) return 'js';
  if (ct.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|svg|ico)(\?|$)/i.test(url)) return 'img';
  if (ct.startsWith('font/') || /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(url)) return 'font';
  if (ct.includes('json')) return 'json';
  return 'other';
}

export function safeFilenameFromUrl(urlStr, kind) {
  try {
    const u = new URL(urlStr);
    const last = u.pathname.split('/').filter(Boolean).pop() || 'index';
    const hash = createHash('sha1').update(urlStr).digest('hex').slice(0, 6);
    const cleaned = last.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (cleaned.includes('.')) return `${hash}-${cleaned}`;
    const extMap = { css: '.css', js: '.js', img: '.bin', font: '.bin', json: '.json', html: '.html' };
    return `${hash}-${cleaned}${extMap[kind] || '.bin'}`;
  } catch {
    const hash = createHash('sha1').update(urlStr).digest('hex').slice(0, 10);
    return `${hash}.bin`;
  }
}

export function resolveUrl(base, ref) {
  if (!ref) return null;
  const t = String(ref).trim();
  if (!t || /^(data|mailto|tel|javascript|blob|about):/i.test(t) || t.startsWith('#')) return null;
  try { return new URL(t, base).toString(); } catch { return null; }
}

/** Slug do site inteiro (1 diretório de cache por host): "https://www.cury.net/x" → "cury-net" */
export function siteSlug(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.host.toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  } catch {
    return createHash('sha1').update(urlStr).digest('hex').slice(0, 10);
  }
}

/** Slug de uma página dentro do site: "/" → "home", "/sobre/empresa" → "sobre-empresa" */
export function pageSlug(urlStr, used = new Set()) {
  let base = 'home';
  try {
    const u = new URL(urlStr);
    const path = u.pathname.replace(/\/$/, '');
    if (path) {
      base = path.split('/').filter(Boolean).join('-')
        .toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'home';
    }
  } catch {}
  let slug = base;
  if (used.has(slug)) {
    const hash = createHash('sha1').update(urlStr).digest('hex').slice(0, 6);
    slug = `${base}-${hash}`;
  }
  used.add(slug);
  return slug;
}

export function fmtBytes(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs < 1024) return `${sign}${abs}B`;
  if (abs < 1024 * 1024) return `${sign}${(abs / 1024).toFixed(1)}KB`;
  return `${sign}${(abs / 1024 / 1024).toFixed(2)}MB`;
}
