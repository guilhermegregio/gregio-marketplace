#!/usr/bin/env node
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

// --- NixOS autodetect: resolve paths do nix store e seta envs ANTES de carregar playwright ---
// Conforme https://wiki.nixos.org/wiki/Playwright — precisamos fixar browsers + executable path,
// senão o driver tenta baixar chromium (bloqueado em NixOS) ou usa lib dinâmica incompatível.
function setupNixEnv() {
  let isNixOS = false;
  try { execSync('test -f /etc/NIXOS', { stdio: 'ignore' }); isNixOS = true; } catch {}
  if (!isNixOS) return;

  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    try {
      const out = execSync('nix-build "<nixpkgs>" -A playwright-driver.browsers --no-out-link', {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (out) process.env.PLAYWRIGHT_BROWSERS_PATH = out;
    } catch (e) {
      process.stderr.write(`[pw-coverage] nix-build falhou: ${e.message}\n`);
      return;
    }
  }

  process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = 'true';

  // PLAYWRIGHT_NODEJS_PATH: força o driver a usar o node do nix (evita mismatch de glibc)
  if (!process.env.PLAYWRIGHT_NODEJS_PATH) {
    try {
      const nodePath = execSync('readlink -f "$(command -v node)"', { encoding: 'utf8', shell: '/bin/sh' }).trim();
      if (nodePath) process.env.PLAYWRIGHT_NODEJS_PATH = nodePath;
    } catch {}
  }

  // PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH: aponta direto pro chromium do nix store,
  // assim não importa se o npm pinou uma versão com build id diferente do que nixpkgs tem.
  if (!process.env.PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH) {
    const browsersDir = process.env.PLAYWRIGHT_BROWSERS_PATH;
    try {
      const candidates = execSync(
        `ls -d ${browsersDir}/chromium-*/chrome-linux*/chrome 2>/dev/null`,
        { encoding: 'utf8', shell: '/bin/sh' }
      ).trim().split('\n').filter(Boolean);
      if (candidates.length > 0) {
        process.env.PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH = candidates[0];
      }
    } catch {}
  }

  process.stderr.write(
    `[pw-coverage] NixOS env:\n` +
    `  PLAYWRIGHT_BROWSERS_PATH=${process.env.PLAYWRIGHT_BROWSERS_PATH}\n` +
    `  PLAYWRIGHT_NODEJS_PATH=${process.env.PLAYWRIGHT_NODEJS_PATH || '(unset)'}\n` +
    `  PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH=${process.env.PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH || '(unset)'}\n`
  );
}
setupNixEnv();

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
  node test-playwright-coverage.js <url...> [options]
  node test-playwright-coverage.js --file=urls.txt [options]

Options:
  --file=<path>            Arquivo com URLs (1 por linha, # = comentário)
  --out=<dir>              Pasta raiz (default: /tmp/ds-pw-coverage-<timestamp>)
  --max-assets=<n>         Total máximo de assets por URL (default: 800)
  --max-img=<n>            Máximo de imagens por URL (default: 200)
  --concurrency=<n>        URLs em paralelo (default: 2)
  --timeout=<ms>           Timeout do goto (default: 60000)
  --wait=<state>           load | domcontentloaded | networkidle (default: networkidle)
  --extra-wait=<ms>        Espera extra após 'wait' antes de ler DOM (default: 1500)
  --screenshot             Salvar screenshot full-page por URL (default: on)
  --no-screenshot
  --no-rewrite             Não reescreve refs no HTML (só coleta)

NixOS:
  O script detecta /etc/NIXOS e executa \`nix-build '<nixpkgs>' -A playwright-driver.browsers\`
  automaticamente, setando PLAYWRIGHT_BROWSERS_PATH + PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS.

  Versão do playwright npm DEVE bater com nixpkgs (atual: 1.58.2).
  Execute via:
    npx --yes --package=playwright@1.58.2 -- node scripts/test-playwright-coverage.js <url>`;

function parseArgs(argv) {
  const args = {
    urls: [],
    file: null,
    out: null,
    maxAssets: 800,
    maxImg: 200,
    concurrency: 2,
    timeout: 60000,
    wait: 'networkidle',
    extraWait: 1500,
    screenshot: true,
    rewrite: true,
  };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--file=')) args.file = a.slice('--file='.length);
    else if (a.startsWith('--out=')) args.out = a.slice('--out='.length);
    else if (a.startsWith('--max-assets=')) args.maxAssets = Number(a.split('=')[1]);
    else if (a.startsWith('--max-img=')) args.maxImg = Number(a.split('=')[1]);
    else if (a.startsWith('--concurrency=')) args.concurrency = Number(a.split('=')[1]);
    else if (a.startsWith('--timeout=')) args.timeout = Number(a.split('=')[1]);
    else if (a.startsWith('--wait=')) args.wait = a.split('=')[1];
    else if (a.startsWith('--extra-wait=')) args.extraWait = Number(a.split('=')[1]);
    else if (a === '--screenshot') args.screenshot = true;
    else if (a === '--no-screenshot') args.screenshot = false;
    else if (a === '--no-rewrite') args.rewrite = false;
    else if (a === '-h' || a === '--help') { console.log(USAGE); process.exit(0); }
    else if (a.startsWith('--')) { console.error(`unknown flag: ${a}`); process.exit(2); }
    else args.urls.push(a);
  }
  return args;
}

function log(msg) { process.stdout.write(`[pw-coverage] ${msg}\n`); }
function warn(msg) { process.stderr.write(`[pw-coverage] ${msg}\n`); }

function kindFromContentType(ct = '', url = '') {
  if (ct.includes('text/html')) return 'html';
  if (ct.includes('text/css') || /\.css(\?|$)/i.test(url)) return 'css';
  if (ct.includes('javascript') || /\.m?js(\?|$)/i.test(url)) return 'js';
  if (ct.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|svg|ico)(\?|$)/i.test(url)) return 'img';
  if (ct.startsWith('font/') || /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(url)) return 'font';
  if (ct.includes('json')) return 'json';
  return 'other';
}

function safeFilenameFromUrl(urlStr, kind) {
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

function resolveUrl(base, ref) {
  if (!ref) return null;
  const t = String(ref).trim();
  if (!t || /^(data|mailto|tel|javascript|blob|about):/i.test(t) || t.startsWith('#')) return null;
  try { return new URL(t, base).toString(); } catch { return null; }
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

async function processUrl(browser, url, rootOut, opts) {
  const t0 = Date.now();
  const result = {
    url,
    finalUrl: null,
    status: null,
    htmlInitialBytes: 0,
    htmlFinalBytes: 0,
    deltaBytes: 0,
    durationMs: 0,
    gotoMs: 0,
    requestsByType: {},
    assetsByKind: { css: 0, js: 0, img: 0, font: 0, html: 0, json: 0, other: 0 },
    bytesByKind: { css: 0, js: 0, img: 0, font: 0, html: 0, json: 0, other: 0 },
    assetsOk: 0,
    assetsFailed: 0,
    droppedTotal: 0,
    droppedImg: 0,
    xhrFetchCount: 0,
    widgets: {},
    consoleErrors: 0,
    pageErrors: 0,
    failures: [],
    error: null,
    outDir: null,
    screenshot: null,
  };

  const outDir = join(rootOut, hostSlug(url));
  result.outDir = outDir;
  await mkdir(outDir, { recursive: true });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const manifest = {
    sourceUrl: url,
    finalUrl: null,
    fetchedAt: new Date().toISOString(),
    assets: {},
  };
  const counters = { total: 0, img: 0, droppedTotal: 0, droppedImg: 0 };

  page.on('console', (msg) => { if (msg.type() === 'error') result.consoleErrors++; });
  page.on('pageerror', () => { result.pageErrors++; });

  page.on('request', (req) => {
    const type = req.resourceType();
    result.requestsByType[type] = (result.requestsByType[type] || 0) + 1;
    if (type === 'xhr' || type === 'fetch') result.xhrFetchCount++;
  });

  page.on('response', async (res) => {
    const rUrl = res.url();
    if (!/^https?:/i.test(rUrl)) return;
    if (manifest.assets[rUrl]) return;
    if (counters.total >= opts.maxAssets) { counters.droppedTotal++; return; }

    let body;
    try { body = await res.body(); }
    catch (e) {
      result.failures.push({ url: rUrl, reason: `body: ${e.message}` });
      return;
    }
    if (!res.ok()) {
      result.failures.push({ url: rUrl, reason: `http ${res.status()}` });
      return;
    }

    const headers = res.headers();
    const ct = headers['content-type'] || '';
    const kind = kindFromContentType(ct, rUrl);

    if (kind === 'img' && counters.img >= opts.maxImg) { counters.droppedImg++; return; }

    // Não salvar o HTML principal aqui — será salvo com o DOM final
    if (kind === 'html' && rUrl === result.finalUrl) return;

    const filename = safeFilenameFromUrl(rUrl, kind);
    const relPath = join('assets', kind, filename);
    const absPath = join(outDir, relPath);

    try {
      await mkdir(dirname(absPath), { recursive: true });
      await writeFile(absPath, body);
      manifest.assets[rUrl] = { kind, path: relPath, bytes: body.length, contentType: ct };
      counters.total++;
      if (kind === 'img') counters.img++;
    } catch (e) {
      result.failures.push({ url: rUrl, reason: `write: ${e.message}` });
    }
  });

  let response;
  try {
    log(`goto ${url}`);
    const gT0 = Date.now();
    response = await page.goto(url, { waitUntil: opts.wait, timeout: opts.timeout });
    result.gotoMs = Date.now() - gT0;
  } catch (e) {
    result.error = `goto failed: ${e.message}`;
    await context.close();
    result.durationMs = Date.now() - t0;
    return result;
  }

  result.status = response ? response.status() : null;
  result.finalUrl = page.url();
  manifest.finalUrl = result.finalUrl;

  try {
    const initialHtml = response ? await response.text() : '';
    result.htmlInitialBytes = Buffer.byteLength(initialHtml, 'utf8');
  } catch {}

  if (opts.extraWait > 0) await page.waitForTimeout(opts.extraWait);

  // Detecta widgets client-side
  result.widgets = await page.evaluate(() => {
    const q = (sel) => document.querySelectorAll(sel).length;
    return {
      iframes: q('iframe'),
      canvas: q('canvas'),
      svg: q('svg'),
      sandpack: q('[class*="sandpack"], [class*="sp-"]'),
      reactRoots: q('[data-reactroot], #__next, #root, #app'),
      shadowHosts: Array.from(document.querySelectorAll('*')).filter((el) => el.shadowRoot).length,
      bodyTextLen: (document.body && document.body.innerText || '').length,
    };
  }).catch(() => ({}));

  const finalHtml = await page.content();
  result.htmlFinalBytes = Buffer.byteLength(finalHtml, 'utf8');
  result.deltaBytes = result.htmlFinalBytes - result.htmlInitialBytes;

  if (opts.screenshot) {
    const shotPath = join(outDir, 'screenshot.png');
    try {
      await page.screenshot({ path: shotPath, fullPage: true });
      result.screenshot = 'screenshot.png';
    } catch (e) { warn(`screenshot failed ${url}: ${e.message}`); }
  }

  await context.close();

  let outputHtml = finalHtml;
  if (opts.rewrite) outputHtml = rewriteHtml(finalHtml, manifest, result.finalUrl);

  await writeFile(join(outDir, 'index.html'), outputHtml);
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  for (const info of Object.values(manifest.assets)) {
    result.assetsByKind[info.kind] = (result.assetsByKind[info.kind] || 0) + 1;
    result.bytesByKind[info.kind] = (result.bytesByKind[info.kind] || 0) + info.bytes;
    result.assetsOk++;
  }
  result.assetsFailed = result.failures.length;
  result.droppedTotal = counters.droppedTotal;
  result.droppedImg = counters.droppedImg;
  result.durationMs = Date.now() - t0;

  const dropMsg = (counters.droppedTotal || counters.droppedImg) ? ` [dropped: t${counters.droppedTotal} i${counters.droppedImg}]` : '';
  log(`done ${url} → ${result.assetsOk} ok, ${result.assetsFailed} fail, Δhtml=${fmtBytes(result.deltaBytes)}, ${result.durationMs}ms${dropMsg}`);
  return result;
}

function rewriteHtml(html, manifest, baseUrl) {
  // Rewrite sem cheerio — regex nos atributos e em url() do CSS inline.
  const map = {};
  for (const [absUrl, info] of Object.entries(manifest.assets)) map[absUrl] = info.path;

  const mapRef = (ref) => {
    const abs = resolveUrl(baseUrl, ref);
    return abs && map[abs] ? map[abs] : null;
  };

  const attrRe = /\b(href|src|data-href|data-src|poster)\s*=\s*("([^"]+)"|'([^']+)')/g;
  let out = html.replace(attrRe, (full, attr, _quoted, dq, sq) => {
    const val = dq ?? sq;
    const local = mapRef(val);
    if (!local) return full;
    const q = dq !== undefined ? '"' : "'";
    return `${attr}=${q}${local}${q}`;
  });

  const srcsetRe = /\bsrcset\s*=\s*("([^"]+)"|'([^']+)')/g;
  out = out.replace(srcsetRe, (full, _quoted, dq, sq) => {
    const val = dq ?? sq;
    const q = dq !== undefined ? '"' : "'";
    const rewritten = val.split(',').map((part) => {
      const t = part.trim();
      if (!t) return '';
      const [u, ...rest] = t.split(/\s+/);
      const local = mapRef(u);
      return local ? [local, ...rest].join(' ') : part;
    }).join(', ');
    return `srcset=${q}${rewritten}${q}`;
  });

  const urlRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
  out = out.replace(urlRe, (full, q, ref) => {
    const local = mapRef(ref);
    return local ? `url(${q}${local}${q})` : full;
  });

  return out;
}

function fmtBytes(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs < 1024) return `${sign}${abs}B`;
  if (abs < 1024 * 1024) return `${sign}${(abs / 1024).toFixed(1)}KB`;
  return `${sign}${(abs / 1024 / 1024).toFixed(2)}MB`;
}

function buildReportMd(results, rootOut) {
  const lines = [];
  lines.push(`# Playwright coverage report`);
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Output root: ${rootOut}`);
  lines.push(`- URLs: ${results.length}`);
  lines.push('');
  lines.push('| URL | status | html init→final (Δ) | css | js | img | font | xhr/fetch | widgets | ok | fail | errs | ms |');
  lines.push('|-----|--------|---------------------|-----|----|-----|------|-----------|---------|----|------|------|----|');
  for (const r of results) {
    const status = r.error ? `ERR: ${r.error.split('\n')[0].slice(0, 80)}` : r.status;
    const deltaPct = r.htmlInitialBytes > 0 ? ` (${((r.deltaBytes / r.htmlInitialBytes) * 100).toFixed(0)}%)` : '';
    const html = `${fmtBytes(r.htmlInitialBytes)}→${fmtBytes(r.htmlFinalBytes)}${deltaPct}`;
    const w = r.widgets || {};
    const widgets = [w.iframes && `iframe:${w.iframes}`, w.sandpack && `sp:${w.sandpack}`, w.canvas && `canvas:${w.canvas}`, w.shadowHosts && `shadow:${w.shadowHosts}`]
      .filter(Boolean).join(' ') || '-';
    const errs = (r.consoleErrors || r.pageErrors) ? `c${r.consoleErrors}/p${r.pageErrors}` : '0';
    lines.push(
      `| ${r.url} | ${status} | ${html} | ${r.assetsByKind.css} | ${r.assetsByKind.js} | ${r.assetsByKind.img} | ${r.assetsByKind.font} | ${r.xhrFetchCount} | ${widgets} | ${r.assetsOk} | ${r.assetsFailed} | ${errs} | ${r.durationMs} |`
    );
  }
  lines.push('');
  lines.push('## Totals');
  const totals = results.reduce((acc, r) => {
    acc.htmlI += r.htmlInitialBytes;
    acc.htmlF += r.htmlFinalBytes;
    for (const k of Object.keys(r.bytesByKind)) acc.bytes[k] = (acc.bytes[k] || 0) + r.bytesByKind[k];
    acc.ok += r.assetsOk;
    acc.fail += r.assetsFailed;
    return acc;
  }, { htmlI: 0, htmlF: 0, bytes: {}, ok: 0, fail: 0 });
  lines.push(`- HTML initial total: ${fmtBytes(totals.htmlI)}`);
  lines.push(`- HTML final total:   ${fmtBytes(totals.htmlF)} (Δ ${fmtBytes(totals.htmlF - totals.htmlI)})`);
  for (const [k, v] of Object.entries(totals.bytes)) if (v > 0) lines.push(`- ${k}: ${fmtBytes(v)}`);
  lines.push(`- Assets ok: ${totals.ok} / failed: ${totals.fail}`);
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  const urls = await loadUrls(args);
  if (urls.length === 0) { console.error(USAGE); process.exit(2); }

  const pw = loadOptional('playwright');
  if (!pw) {
    console.error(
      'playwright não resolvível. Execute via:\n' +
      '  npx --yes --package=playwright@1.58.2 -- node scripts/test-playwright-coverage.js <url>\n' +
      'Em NixOS, o script já seta PLAYWRIGHT_BROWSERS_PATH automaticamente.'
    );
    process.exit(2);
  }

  const rootOut = resolve(args.out || `/tmp/ds-pw-coverage-${Date.now()}`);
  await mkdir(rootOut, { recursive: true });
  log(`root: ${rootOut}`);
  log(`processing ${urls.length} url(s) with concurrency=${args.concurrency}`);

  const launchOpts = { headless: true };
  if (process.env.PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH) {
    launchOpts.executablePath = process.env.PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH;
  }
  const browser = await pw.chromium.launch(launchOpts);

  let results;
  try {
    results = await pLimit(urls, args.concurrency, (u) => processUrl(browser, u, rootOut, args));
  } finally {
    await browser.close();
  }

  await writeFile(join(rootOut, 'report.json'), JSON.stringify(results, null, 2));
  await writeFile(join(rootOut, 'report.md'), buildReportMd(results, rootOut));
  log(`report → ${join(rootOut, 'report.md')}`);
}

main().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
