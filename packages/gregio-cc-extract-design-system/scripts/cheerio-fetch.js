import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  loadOptional, log, warn, resolveUrl, kindFromContentType,
  hostSlug, downloadAsset, pLimit,
} from './shared.js';

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

export function analyzeSpa($) {
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

/**
 * Faz fetch estático de uma URL usando cheerio.
 * @param {string} url
 * @param {string} outDir - diretório de saída (já deve existir ou será criado)
 * @param {{ maxAssets?: number, maxImg?: number, assetConcurrency?: number, rewrite?: boolean }} opts
 * @returns {Promise<{ url, finalUrl, status, htmlBytes, spa, manifest, assetsOk, assetsFailed, failures, durationMs, error }>}
 */
export async function fetchWithCheerio(url, outDir, opts = {}) {
  const { maxAssets = 800, maxImg = 200, assetConcurrency = 8, rewrite = true } = opts;
  const t0 = Date.now();
  const result = {
    url, finalUrl: null, status: null, htmlBytes: 0, mode: 'cheerio',
    spa: null, assetsOk: 0, assetsFailed: 0, failures: [], error: null, outDir, durationMs: 0,
  };

  await mkdir(outDir, { recursive: true });

  const cheerio = loadOptional('cheerio');
  if (!cheerio) {
    result.error = 'cheerio not resolvable';
    return result;
  }

  let html;
  try {
    log(`[cheerio] fetch ${url}`);
    const res = await fetch(url, { redirect: 'follow' });
    result.status = res.status;
    result.finalUrl = res.url || url;
    if (!res.ok) { result.error = `HTTP ${res.status}`; result.durationMs = Date.now() - t0; return result; }
    html = await res.text();
    result.htmlBytes = Buffer.byteLength(html, 'utf8');
  } catch (e) {
    result.error = `fetch failed: ${e.message}`;
    result.durationMs = Date.now() - t0;
    return result;
  }

  const $ = cheerio.load(html);
  result.spa = analyzeSpa($);

  const refs = collectRefs(result.finalUrl, $);
  const manifest = { sourceUrl: url, finalUrl: result.finalUrl, mode: 'cheerio', fetchedAt: new Date().toISOString(), assets: {} };
  const counters = { total: 0, img: 0, droppedTotal: 0, droppedImg: 0 };
  const limits = { maxAssets, maxImg };

  await pLimit(refs, assetConcurrency, (u) =>
    downloadAsset(u, outDir, manifest, result.failures, counters, limits)
  );

  await processCssChain(outDir, manifest, result.failures, counters, limits);
  if (rewrite) rewriteHtml($, manifest, result.finalUrl);

  for (const info of Object.values(manifest.assets)) result.assetsOk++;
  result.assetsFailed = result.failures.length;
  result.manifest = manifest;

  await writeFile(join(outDir, 'index.html'), $.html());
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  result.durationMs = Date.now() - t0;
  log(`[cheerio] done ${url} → ${result.assetsOk} ok, ${result.assetsFailed} fail, ${result.durationMs}ms`);
  return result;
}
