import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import {
  loadOptional, log, warn, resolveUrl, kindFromContentType,
  safeFilenameFromUrl,
} from './shared.js';

export function setupNixEnv() {
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
      warn(`nix-build falhou: ${e.message}`);
      return;
    }
  }

  process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = 'true';

  if (!process.env.PLAYWRIGHT_NODEJS_PATH) {
    try {
      const nodePath = execSync('readlink -f "$(command -v node)"', { encoding: 'utf8', shell: '/bin/sh' }).trim();
      if (nodePath) process.env.PLAYWRIGHT_NODEJS_PATH = nodePath;
    } catch {}
  }

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

  log(`NixOS: PLAYWRIGHT_BROWSERS_PATH=${process.env.PLAYWRIGHT_BROWSERS_PATH}`);
}

export async function launchBrowser() {
  setupNixEnv();
  const pw = loadOptional('playwright');
  if (!pw) throw new Error('playwright not resolvable');
  const launchOpts = { headless: true };
  if (process.env.PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH) {
    launchOpts.executablePath = process.env.PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH;
  }
  return pw.chromium.launch(launchOpts);
}

function rewriteHtml(html, manifest, baseUrl) {
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

/**
 * Faz fetch de uma URL usando Playwright (headless Chromium).
 * @param {import('playwright').Browser} browser - instância do browser (via launchBrowser)
 * @param {string} url
 * @param {string} outDir
 * @param {{ maxAssets?: number, maxImg?: number, timeout?: number, wait?: string, extraWait?: number, rewrite?: boolean, screenshot?: boolean }} opts
 */
export async function fetchWithPlaywright(browser, url, outDir, opts = {}) {
  const {
    maxAssets = 800, maxImg = 200, timeout = 60000,
    wait = 'networkidle', extraWait = 1500, rewrite = true, screenshot = false,
  } = opts;
  const t0 = Date.now();
  const result = {
    url, finalUrl: null, status: null, htmlBytes: 0, mode: 'playwright',
    spa: null, assetsOk: 0, assetsFailed: 0, failures: [], error: null, outDir, durationMs: 0,
  };

  await mkdir(outDir, { recursive: true });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const manifest = { sourceUrl: url, finalUrl: null, mode: 'playwright', fetchedAt: new Date().toISOString(), assets: {} };
  const counters = { total: 0, img: 0, droppedTotal: 0, droppedImg: 0 };

  page.on('response', async (res) => {
    const rUrl = res.url();
    if (!/^https?:/i.test(rUrl)) return;
    if (manifest.assets[rUrl]) return;
    if (counters.total >= maxAssets) { counters.droppedTotal++; return; }

    let body;
    try { body = await res.body(); }
    catch { return; }
    if (!res.ok()) { result.failures.push({ url: rUrl, reason: `http ${res.status()}` }); return; }

    const ct = (res.headers()['content-type'] || '');
    const kind = kindFromContentType(ct, rUrl);
    if (kind === 'img' && counters.img >= maxImg) { counters.droppedImg++; return; }

    const filename = safeFilenameFromUrl(rUrl, kind);
    const relPath = join('assets', kind, filename);
    const absPath = join(outDir, relPath);

    try {
      await mkdir(dirname(absPath), { recursive: true });
      await writeFile(absPath, body);
      manifest.assets[rUrl] = { kind, path: relPath, bytes: body.length, contentType: ct };
      counters.total++;
      if (kind === 'img') counters.img++;
    } catch {}
  });

  let response;
  try {
    log(`[playwright] goto ${url}`);
    response = await page.goto(url, { waitUntil: wait, timeout });
  } catch (e) {
    result.error = `goto failed: ${e.message.split('\n')[0]}`;
    await context.close();
    result.durationMs = Date.now() - t0;
    return result;
  }

  result.status = response ? response.status() : null;
  result.finalUrl = page.url();
  manifest.finalUrl = result.finalUrl;

  if (extraWait > 0) await page.waitForTimeout(extraWait);

  const finalHtml = await page.content();
  result.htmlBytes = Buffer.byteLength(finalHtml, 'utf8');

  if (screenshot) {
    try { await page.screenshot({ path: join(outDir, 'screenshot.png'), fullPage: true }); }
    catch (e) { warn(`screenshot failed: ${e.message}`); }
  }

  await context.close();

  let outputHtml = finalHtml;
  if (rewrite) outputHtml = rewriteHtml(finalHtml, manifest, result.finalUrl);

  for (const info of Object.values(manifest.assets)) result.assetsOk++;
  result.assetsFailed = result.failures.length;
  result.manifest = manifest;

  await writeFile(join(outDir, 'index.html'), outputHtml);
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  result.durationMs = Date.now() - t0;
  log(`[playwright] done ${url} → ${result.assetsOk} ok, ${result.assetsFailed} fail, ${result.durationMs}ms`);
  return result;
}
