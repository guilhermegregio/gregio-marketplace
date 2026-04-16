#!/usr/bin/env node
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

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

const USAGE = `Usage:
  node test-cheerio-coverage.js <url...> [options]
  node test-cheerio-coverage.js --file=urls.txt [options]

Options:
  --file=<path>            Arquivo com URLs (1 por linha, # = comentário)
  --out=<dir>              Pasta raiz (default: /tmp/ds-coverage-<timestamp>)
  --max-assets=<n>         Total máximo de assets por URL (default: 800)
  --max-img=<n>            Máximo de imagens por URL (default: 200)
  --concurrency=<n>        URLs em paralelo (default: 3)
  --asset-concurrency=<n>  Downloads paralelos por URL (default: 8)
  --no-rewrite             Não reescreve refs no HTML/CSS (só coleta)`;

function parseArgs(argv) {
  const args = {
    urls: [],
    file: null,
    out: null,
    maxAssets: 800,
    maxImg: 200,
    concurrency: 3,
    assetConcurrency: 8,
    rewrite: true,
  };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--file=')) args.file = a.slice('--file='.length);
    else if (a.startsWith('--out=')) args.out = a.slice('--out='.length);
    else if (a.startsWith('--max-assets=')) args.maxAssets = Number(a.split('=')[1]);
    else if (a.startsWith('--max-img=')) args.maxImg = Number(a.split('=')[1]);
    else if (a.startsWith('--concurrency=')) args.concurrency = Number(a.split('=')[1]);
    else if (a.startsWith('--asset-concurrency=')) args.assetConcurrency = Number(a.split('=')[1]);
    else if (a === '--no-rewrite') args.rewrite = false;
    else if (a === '-h' || a === '--help') { console.log(USAGE); process.exit(0); }
    else if (a.startsWith('--')) { console.error(`unknown flag: ${a}`); process.exit(2); }
    else args.urls.push(a);
  }
  return args;
}

function log(msg) { process.stdout.write(`[coverage] ${msg}\n`); }
function warn(msg) { process.stderr.write(`[coverage] ${msg}\n`); }

function kindFromContentType(ct = '', url = '') {
  if (ct.includes('text/css') || /\.css(\?|$)/i.test(url)) return 'css';
  if (ct.includes('javascript') || /\.m?js(\?|$)/i.test(url)) return 'js';
  if (ct.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|svg|ico)(\?|$)/i.test(url)) return 'img';
  if (ct.startsWith('font/') || /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(url)) return 'font';
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
  if (!ref) return null;
  const trimmed = String(ref).trim();
  if (!trimmed) return null;
  if (/^data:/i.test(trimmed)) return null;
  if (/^(mailto|tel|javascript|blob|about):/i.test(trimmed)) return null;
  if (trimmed.startsWith('#')) return null;
  try { return new URL(trimmed, base).toString(); } catch { return null; }
}

function hostSlug(urlStr) {
  try {
    const u = new URL(urlStr);
    const p = u.pathname.replace(/\/$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    return u.host + (p ? p : '');
  } catch {
    return createHash('sha1').update(urlStr).digest('hex').slice(0, 10);
  }
}

async function loadUrls(args) {
  const all = [...args.urls];
  if (args.file) {
    const content = await readFile(args.file, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      all.push(trimmed);
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

async function pLimit(items, limit, fn) {
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

async function downloadAsset(url, outDir, manifest, failures, counters, limits) {
  if (manifest.assets[url]) return manifest.assets[url];
  if (counters.total >= limits.maxAssets) {
    counters.droppedTotal++;
    return null;
  }
  let res;
  try { res = await fetch(url, { redirect: 'follow' }); }
  catch (e) {
    failures.push({ url, reason: `network: ${e.message}` });
    return null;
  }
  if (!res.ok) {
    failures.push({ url, reason: `http ${res.status}` });
    return null;
  }

  const ct = res.headers.get('content-type') || '';
  const kind = kindFromContentType(ct, url);
  if (kind === 'img' && counters.img >= limits.maxImg) {
    counters.droppedImg++;
    return null;
  }

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

function collectRefs(base, $) {
  const refs = new Set();
  const add = (ref) => { const abs = resolveUrl(base, ref); if (abs && /^https?:/i.test(abs)) refs.add(abs); };

  $('link[href]').each((_, el) => add($(el).attr('href')));
  $('link[data-href]').each((_, el) => add($(el).attr('data-href')));
  $('script[src]').each((_, el) => add($(el).attr('src')));
  $('script[data-src]').each((_, el) => add($(el).attr('data-src')));
  $('img[src]').each((_, el) => add($(el).attr('src')));
  $('img[data-src], source[data-src]').each((_, el) => add($(el).attr('data-src')));
  $('video[src], audio[src], source[src]').each((_, el) => add($(el).attr('src')));
  $('video[poster]').each((_, el) => add($(el).attr('poster')));
  $('[srcset]').each((_, el) => {
    const srcset = $(el).attr('srcset') || '';
    for (const part of srcset.split(',')) {
      const u = part.trim().split(/\s+/)[0];
      if (u) add(u);
    }
  });

  const urlRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
  $('style').each((_, el) => {
    const css = $(el).html() || '';
    let m;
    while ((m = urlRe.exec(css))) add(m[2]);
    const impRe = /@import\s+(?:url\()?\s*['"]?([^'")]+)['"]?\s*\)?/g;
    while ((m = impRe.exec(css))) add(m[1]);
  });
  $('[style]').each((_, el) => {
    const css = $(el).attr('style') || '';
    let m;
    while ((m = urlRe.exec(css))) add(m[2]);
  });

  return [...refs];
}

async function processCssChain(outDir, manifest, failures, counters, limits, depthLimit = 2) {
  const processed = new Set();
  for (let depth = 0; depth < depthLimit; depth++) {
    const pending = Object.entries(manifest.assets)
      .filter(([u, v]) => v.kind === 'css' && !processed.has(u));
    if (pending.length === 0) break;

    for (const [cssUrl, info] of pending) {
      processed.add(cssUrl);
      const cssPath = join(outDir, info.path);
      let css;
      try { css = await readFile(cssPath, 'utf8'); } catch { continue; }

      const urlRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
      const importRe = /@import\s+(?:url\(\s*)?['"]?([^'")]+)['"]?\s*\)?\s*;?/g;

      const refs = new Set();
      let m;
      while ((m = urlRe.exec(css))) {
        const abs = resolveUrl(cssUrl, m[2]);
        if (abs && /^https?:/i.test(abs)) refs.add(abs);
      }
      while ((m = importRe.exec(css))) {
        const abs = resolveUrl(cssUrl, m[1]);
        if (abs && /^https?:/i.test(abs)) refs.add(abs);
      }

      for (const abs of refs) {
        const sub = await downloadAsset(abs, outDir, manifest, failures, counters, limits);
        if (sub) {
          const toRel = '../' + sub.path.replace(/^assets\//, '');
          css = css.split(abs).join(toRel);
        }
      }
      await writeFile(cssPath, css);
    }
  }
}

function rewriteHtml($, manifest, baseUrl) {
  const mapRef = (ref) => {
    const abs = resolveUrl(baseUrl, ref);
    const info = abs && manifest.assets[abs];
    return info ? info.path : null;
  };
  const rewriteAttr = (sel, attr) => {
    $(sel).each((_, el) => {
      const val = $(el).attr(attr); if (!val) return;
      const local = mapRef(val);
      if (local) $(el).attr(attr, local);
    });
  };
  rewriteAttr('link[href]', 'href');
  rewriteAttr('link[data-href]', 'data-href');
  rewriteAttr('script[src]', 'src');
  rewriteAttr('script[data-src]', 'data-src');
  rewriteAttr('img[src]', 'src');
  rewriteAttr('img[data-src], source[data-src]', 'data-src');
  rewriteAttr('video[src], audio[src], source[src]', 'src');
  rewriteAttr('video[poster]', 'poster');

  $('[srcset]').each((_, el) => {
    const srcset = $(el).attr('srcset') || '';
    const rewritten = srcset.split(',').map((part) => {
      const t = part.trim();
      if (!t) return '';
      const [u, ...rest] = t.split(/\s+/);
      const local = mapRef(u);
      return local ? [local, ...rest].join(' ') : part;
    }).join(', ');
    $(el).attr('srcset', rewritten);
  });

  const urlRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
  $('style').each((_, el) => {
    const css = $(el).html() || '';
    const next = css.replace(urlRe, (full, q, ref) => {
      const local = mapRef(ref);
      return local ? `url(${q}${local}${q})` : full;
    });
    if (next !== css) $(el).html(next);
  });
  $('[style]').each((_, el) => {
    const css = $(el).attr('style') || '';
    const next = css.replace(urlRe, (full, q, ref) => {
      const local = mapRef(ref);
      return local ? `url(${q}${local}${q})` : full;
    });
    if (next !== css) $(el).attr('style', next);
  });
}

function analyzeSpa($) {
  const bodyText = ($('body').text() || '').trim();
  const scripts = $('script').length;
  const contentEls = $('body p, body h1, body h2, body h3, body article, body main, body section').length;
  const emptyRoots = ['#root', '#app', '#__next', '#__nuxt']
    .filter((sel) => $(sel).length > 0 && $(sel).children().length === 0);
  const reasons = [];
  if (bodyText.length < 200) reasons.push(`body text ${bodyText.length} chars`);
  if (emptyRoots.length > 0) reasons.push(`empty root: ${emptyRoots.join(',')}`);
  if (scripts > 0 && contentEls < 3) reasons.push(`${scripts} <script> vs ${contentEls} content els`);
  return { suspect: reasons.length > 0, reasons, bodyTextLength: bodyText.length, scripts, contentEls };
}

async function processUrl(url, rootOut, opts) {
  const t0 = Date.now();
  const result = {
    url,
    finalUrl: null,
    status: null,
    htmlBytes: 0,
    durationMs: 0,
    spa: null,
    assetsByKind: { css: 0, js: 0, img: 0, font: 0, other: 0 },
    bytesByKind: { css: 0, js: 0, img: 0, font: 0, other: 0 },
    assetsOk: 0,
    assetsFailed: 0,
    droppedTotal: 0,
    droppedImg: 0,
    failures: [],
    error: null,
    outDir: null,
  };

  const outDir = join(rootOut, hostSlug(url));
  result.outDir = outDir;
  await mkdir(outDir, { recursive: true });

  const cheerio = loadOptional('cheerio');
  if (!cheerio) {
    result.error = 'cheerio not resolvable — run via npx --yes --package=cheerio@^1 -- node ...';
    return result;
  }
  const { load } = cheerio;

  let html;
  try {
    log(`fetch ${url}`);
    const res = await fetch(url, { redirect: 'follow' });
    result.status = res.status;
    result.finalUrl = res.url || url;
    if (!res.ok) {
      result.error = `HTTP ${res.status}`;
      result.durationMs = Date.now() - t0;
      return result;
    }
    html = await res.text();
    result.htmlBytes = Buffer.byteLength(html, 'utf8');
  } catch (e) {
    result.error = `fetch failed: ${e.message}`;
    result.durationMs = Date.now() - t0;
    return result;
  }

  const $ = load(html);
  result.spa = analyzeSpa($);

  const refs = collectRefs(result.finalUrl, $);
  const manifest = {
    sourceUrl: url,
    finalUrl: result.finalUrl,
    fetchedAt: new Date().toISOString(),
    assets: {},
  };
  const counters = { total: 0, img: 0, droppedTotal: 0, droppedImg: 0 };
  const limits = { maxAssets: opts.maxAssets, maxImg: opts.maxImg };

  await pLimit(refs, opts.assetConcurrency, (u) =>
    downloadAsset(u, outDir, manifest, result.failures, counters, limits)
  );

  await processCssChain(outDir, manifest, result.failures, counters, limits);

  if (opts.rewrite) rewriteHtml($, manifest, result.finalUrl);

  for (const info of Object.values(manifest.assets)) {
    result.assetsByKind[info.kind] = (result.assetsByKind[info.kind] || 0) + 1;
    result.bytesByKind[info.kind] = (result.bytesByKind[info.kind] || 0) + info.bytes;
    result.assetsOk++;
  }
  result.assetsFailed = result.failures.length;
  result.droppedTotal = counters.droppedTotal;
  result.droppedImg = counters.droppedImg;

  await writeFile(join(outDir, 'index.html'), $.html());
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  result.durationMs = Date.now() - t0;
  const dropMsg = (counters.droppedTotal || counters.droppedImg) ? ` [dropped: total=${counters.droppedTotal} img=${counters.droppedImg}]` : '';
  log(`done ${url} → ${result.assetsOk} ok, ${result.assetsFailed} fail, ${result.durationMs}ms${dropMsg}`);
  return result;
}

function fmtBytes(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

function buildReportMd(results, rootOut) {
  const lines = [];
  lines.push(`# Cheerio coverage report`);
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Output root: ${rootOut}`);
  lines.push(`- URLs: ${results.length}`);
  lines.push('');
  lines.push('| URL | status | html | css | js | img | font | ok | fail | drop | spa? | ms |');
  lines.push('|-----|--------|------|-----|----|----|------|----|------|------|------|----|');
  for (const r of results) {
    const spa = r.spa ? (r.spa.suspect ? `yes (${r.spa.reasons.join('; ')})` : 'no') : '-';
    const status = r.error ? `ERR: ${r.error}` : r.status;
    const drop = (r.droppedTotal || r.droppedImg) ? `t${r.droppedTotal}/i${r.droppedImg}` : '0';
    lines.push(
      `| ${r.url} | ${status} | ${fmtBytes(r.htmlBytes)} | ${r.assetsByKind.css} | ${r.assetsByKind.js} | ${r.assetsByKind.img} | ${r.assetsByKind.font} | ${r.assetsOk} | ${r.assetsFailed} | ${drop} | ${spa} | ${r.durationMs} |`
    );
  }
  lines.push('');
  lines.push('## Totals');
  const totals = results.reduce((acc, r) => {
    acc.html += r.htmlBytes;
    for (const k of Object.keys(r.bytesByKind)) acc.bytes[k] = (acc.bytes[k] || 0) + r.bytesByKind[k];
    acc.ok += r.assetsOk;
    acc.fail += r.assetsFailed;
    return acc;
  }, { html: 0, bytes: {}, ok: 0, fail: 0 });
  lines.push(`- HTML total: ${fmtBytes(totals.html)}`);
  for (const [k, v] of Object.entries(totals.bytes)) lines.push(`- ${k}: ${fmtBytes(v)}`);
  lines.push(`- Assets ok: ${totals.ok} / failed: ${totals.fail}`);
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  const urls = await loadUrls(args);
  if (urls.length === 0) { console.error(USAGE); process.exit(2); }

  const rootOut = resolve(args.out || `/tmp/ds-coverage-${Date.now()}`);
  await mkdir(rootOut, { recursive: true });
  log(`root: ${rootOut}`);
  log(`processing ${urls.length} url(s) with concurrency=${args.concurrency}`);

  const results = await pLimit(urls, args.concurrency, (u) =>
    processUrl(u, rootOut, {
      maxAssets: args.maxAssets,
      maxImg: args.maxImg,
      assetConcurrency: args.assetConcurrency,
      rewrite: args.rewrite,
    })
  );

  await writeFile(join(rootOut, 'report.json'), JSON.stringify(results, null, 2));
  const md = buildReportMd(results, rootOut);
  await writeFile(join(rootOut, 'report.md'), md);
  log(`report → ${join(rootOut, 'report.md')}`);
}

main().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
