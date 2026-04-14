#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

// Resolve optional deps (cheerio, playwright) on-demand.
// When invoked via `npx --yes --package=cheerio@1 -- node fetch-site.js ...`,
// npx only adds <cache>/node_modules/.bin to PATH — it does NOT put the
// package on NODE_PATH for our script. So we derive the npx cache dir from
// PATH and build a createRequire rooted there.
const require = createRequire(import.meta.url);

function findNpxNodeModules() {
  const paths = (process.env.PATH || '').split(':');
  for (const p of paths) {
    if (p.includes('/_npx/') && p.endsWith('/.bin')) {
      return p.replace(/\/\.bin$/, '');
    }
  }
  return null;
}

function loadOptional(name) {
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

const USAGE = 'Usage: node fetch-site.js <url> <outDir> [--spa] [--max-assets=N]';

function parseArgs(argv) {
  const args = { spa: false, maxAssets: 300 };
  const positional = [];
  for (const a of argv.slice(2)) {
    if (a === '--spa') args.spa = true;
    else if (a.startsWith('--max-assets=')) args.maxAssets = Number(a.split('=')[1]);
    else positional.push(a);
  }
  args.url = positional[0];
  args.outDir = positional[1];
  return args;
}

function warn(msg) { process.stderr.write(`[fetch-site] ${msg}\n`); }
function log(msg) { process.stdout.write(`[fetch-site] ${msg}\n`); }

function kindFromContentType(ct = '', url = '') {
  if (ct.includes('text/css') || url.endsWith('.css')) return 'css';
  if (ct.includes('javascript') || url.match(/\.m?js(\?|$)/)) return 'js';
  if (ct.startsWith('image/') || url.match(/\.(png|jpe?g|gif|webp|avif|svg|ico)(\?|$)/i)) return 'img';
  if (ct.startsWith('font/') || url.match(/\.(woff2?|ttf|otf|eot)(\?|$)/i)) return 'font';
  return 'other';
}

function safeFilenameFromUrl(urlStr, kind) {
  try {
    const u = new URL(urlStr);
    const last = u.pathname.split('/').filter(Boolean).pop() || 'index';
    const hash = createHash('sha1').update(urlStr).digest('hex').slice(0, 6);
    const cleaned = last.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (cleaned.includes('.')) return `${hash}-${cleaned}`;
    const ext = kind === 'css' ? '.css' : kind === 'js' ? '.js' : kind === 'img' ? '.bin' : kind === 'font' ? '.bin' : '.bin';
    return `${hash}-${cleaned}${ext}`;
  } catch {
    const hash = createHash('sha1').update(urlStr).digest('hex').slice(0, 10);
    return `${hash}.bin`;
  }
}

function resolveUrl(base, ref) {
  try { return new URL(ref, base).toString(); } catch { return null; }
}

async function downloadAsset(url, outDir, manifest) {
  if (manifest.assets[url]) return manifest.assets[url];
  let res;
  try { res = await fetch(url); }
  catch (e) { warn(`fetch failed: ${url} — ${e.message}`); return null; }
  if (!res.ok) { warn(`${res.status} ${url}`); return null; }

  const ct = res.headers.get('content-type') || '';
  const kind = kindFromContentType(ct, url);
  const filename = safeFilenameFromUrl(url, kind);
  const relPath = join('assets', kind, filename);
  const absPath = join(outDir, relPath);

  await mkdir(dirname(absPath), { recursive: true });
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(absPath, buf);

  manifest.assets[url] = { kind, path: relPath, bytes: buf.length, contentType: ct };
  return manifest.assets[url];
}

async function fetchWithCheerio(url, outDir, maxAssets) {
  const cheerio = loadOptional('cheerio');
  if (!cheerio) {
    throw new Error(
      'cheerio not resolvable. Run this script via:\n' +
      '  npx --yes --package=cheerio@1 -- node ' + import.meta.url.replace('file://', '') + ' <url> <outDir>\n' +
      'Or install cheerio in the scripts folder.'
    );
  }
  const { load } = cheerio;
  log(`fetching ${url}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const html = await res.text();
  const baseUrl = res.url || url;

  const manifest = { sourceUrl: url, finalUrl: baseUrl, mode: 'static', fetchedAt: new Date().toISOString(), assets: {} };

  const $ = load(html);
  const refs = new Set();

  $('link[rel~="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href'); if (href) refs.add(href);
  });
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src'); if (src) refs.add(src);
  });
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src'); if (src) refs.add(src);
  });
  $('source[srcset], img[srcset]').each((_, el) => {
    const srcset = $(el).attr('srcset') || '';
    for (const part of srcset.split(',')) {
      const u = part.trim().split(/\s+/)[0];
      if (u) refs.add(u);
    }
  });
  $('link[rel~="icon"], link[rel~="apple-touch-icon"], link[rel~="preload"]').each((_, el) => {
    const href = $(el).attr('href'); if (href) refs.add(href);
  });

  const absRefs = [...refs]
    .map((r) => resolveUrl(baseUrl, r))
    .filter((u) => u && /^https?:/i.test(u))
    .slice(0, maxAssets);

  log(`downloading ${absRefs.length} assets`);
  await Promise.all(absRefs.map((u) => downloadAsset(u, outDir, manifest)));

  // Rewrite references in HTML to local paths
  const rewrite = (attr) => (_, el) => {
    const val = $(el).attr(attr); if (!val) return;
    const abs = resolveUrl(baseUrl, val);
    const info = abs && manifest.assets[abs];
    if (info) $(el).attr(attr, info.path);
  };
  $('link[href]').each(rewrite('href'));
  $('script[src]').each(rewrite('src'));
  $('img[src]').each(rewrite('src'));

  // Also download CSS-referenced assets (fonts, background-images) at first level
  for (const [assetUrl, info] of Object.entries(manifest.assets)) {
    if (info.kind !== 'css') continue;
    try {
      const cssPath = join(outDir, info.path);
      const { readFile, writeFile: writeBack } = await import('node:fs/promises');
      let css = await readFile(cssPath, 'utf8');
      const urlRe = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
      const found = new Set();
      let m;
      while ((m = urlRe.exec(css))) {
        const abs = resolveUrl(assetUrl, m[1]);
        if (abs && /^https?:/i.test(abs)) found.add(abs);
      }
      for (const abs of [...found].slice(0, maxAssets)) {
        const sub = await downloadAsset(abs, outDir, manifest);
        if (sub) {
          const toRel = sub.path.startsWith('assets/') ? '../' + sub.path.replace(/^assets\//, '') : sub.path;
          css = css.split(abs).join(toRel);
        }
      }
      await writeBack(cssPath, css);
    } catch (e) { warn(`css rewrite failed for ${assetUrl}: ${e.message}`); }
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'index.html'), $.html());
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  log(`done → ${outDir}`);
}

async function fetchWithPlaywright(url, outDir, maxAssets) {
  const pw = loadOptional('playwright');
  if (!pw) {
    throw new Error(
      'playwright not resolvable. Run this script via:\n' +
      '  npx --yes --package=cheerio@1 --package=playwright@1.48 -- node ' + import.meta.url.replace('file://', '') + ' <url> <outDir> --spa\n' +
      'First run will download Chromium (~150MB) — subsequent runs use the npx cache.\n' +
      'If Chromium is missing: npx --yes playwright install chromium'
    );
  }

  const browser = await pw.chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const manifest = { sourceUrl: url, mode: 'spa', fetchedAt: new Date().toISOString(), assets: {} };
  let count = 0;

  page.on('response', async (res) => {
    if (count >= maxAssets) return;
    const rUrl = res.url();
    if (!/^https?:/i.test(rUrl) || rUrl === url) return;
    if (manifest.assets[rUrl]) return;
    const ct = res.headers()['content-type'] || '';
    const kind = kindFromContentType(ct, rUrl);
    if (kind === 'other') return;
    try {
      const buf = await res.body();
      const filename = safeFilenameFromUrl(rUrl, kind);
      const relPath = join('assets', kind, filename);
      const absPath = join(outDir, relPath);
      await mkdir(dirname(absPath), { recursive: true });
      await writeFile(absPath, buf);
      manifest.assets[rUrl] = { kind, path: relPath, bytes: buf.length, contentType: ct };
      count++;
    } catch (e) { warn(`playwright body failed ${rUrl}: ${e.message}`); }
  });

  log(`[spa] launching chromium for ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  const html = await page.content();
  manifest.finalUrl = page.url();

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'index.html'), html);
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await browser.close();
  log(`done → ${outDir} (${count} assets captured)`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.url || !args.outDir) { console.error(USAGE); process.exit(2); }
  const outDir = resolve(args.outDir);
  await mkdir(outDir, { recursive: true });
  if (args.spa) await fetchWithPlaywright(args.url, outDir, args.maxAssets);
  else await fetchWithCheerio(args.url, outDir, args.maxAssets);
}

main().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
