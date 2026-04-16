import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
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

export function log(msg) { process.stdout.write(`[fetch-site] ${msg}\n`); }
export function warn(msg) { process.stderr.write(`[fetch-site] ${msg}\n`); }

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

export function hostSlug(urlStr) {
  try {
    const u = new URL(urlStr);
    const p = u.pathname.replace(/\/$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    return u.host + (p || '');
  } catch {
    return createHash('sha1').update(urlStr).digest('hex').slice(0, 10);
  }
}

export async function pLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function loadUrls(args) {
  const all = [...(args.urls || [])];
  if (args.file) {
    const content = await readFile(args.file, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      all.push(t);
    }
  }
  const seen = new Set();
  const out = [];
  for (const u of all) {
    if (!/^https?:\/\//i.test(u)) { warn(`ignoring (not http/https): ${u}`); continue; }
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

export async function downloadAsset(url, outDir, manifest, failures, counters, limits) {
  if (manifest.assets[url]) return manifest.assets[url];
  if (counters.total >= limits.maxAssets) { counters.droppedTotal++; return null; }

  let res;
  try { res = await fetch(url, { redirect: 'follow' }); }
  catch (e) { failures.push({ url, reason: `network: ${e.message}` }); return null; }
  if (!res.ok) { failures.push({ url, reason: `http ${res.status}` }); return null; }

  const ct = res.headers.get('content-type') || '';
  const kind = kindFromContentType(ct, url);
  if (kind === 'img' && counters.img >= limits.maxImg) { counters.droppedImg++; return null; }

  const filename = safeFilenameFromUrl(url, kind);
  const relPath = join('assets', kind, filename);
  const absPath = join(outDir, relPath);

  await mkdir(dirname(absPath), { recursive: true });
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(absPath, buf);

  manifest.assets[url] = { kind, path: relPath, bytes: buf.length, contentType: ct };
  counters.total++;
  if (kind === 'img') counters.img++;
  return manifest.assets[url];
}

export function fmtBytes(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs < 1024) return `${sign}${abs}B`;
  if (abs < 1024 * 1024) return `${sign}${(abs / 1024).toFixed(1)}KB`;
  return `${sign}${(abs / 1024 / 1024).toFixed(2)}MB`;
}
