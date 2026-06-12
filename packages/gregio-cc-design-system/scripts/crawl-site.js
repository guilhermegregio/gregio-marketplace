#!/usr/bin/env node
// Crawler Playwright-only para extração de design systems.
// Baixa um site multi-página (BFS, mesma origem, nav primeiro) num cache local
// estruturado e reutilizável — ver references/cache-layout.md para o contrato.
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import {
  loadOptional, log, warn, resolveUrl, kindFromContentType,
  safeFilenameFromUrl, siteSlug, pageSlug, fmtBytes,
} from './shared.js';

const USAGE = `Usage:
  node crawl-site.js <url> [options]

Options:
  --out=<dir>          Raiz do cache (default: ./.ds-cache). Site vai em <out>/<site-slug>/
  --max-pages=<n>      Máximo de páginas a baixar (default: 10)
  --max-depth=<n>      Profundidade máxima de links (entry = 0; default: 2)
  --include=<regex>    Só segue links cujo pathname casa com o regex
  --exclude=<regex>    Nunca segue links cujo pathname casa (soma à blocklist embutida)
  --max-assets=<n>     Total de assets do site, dedup global (default: 1500)
  --max-img=<n>        Máximo de imagens (default: 400)
  --timeout=<ms>       Timeout do goto (default: 60000)
  --wait=<state>       waitUntil do goto: networkidle|load|domcontentloaded (default: networkidle)
  --extra-wait=<ms>    Espera extra pós-load para animações/lazy (default: 1500)
  --no-mobile          Não tirar screenshot mobile (default: tira)
  --sections           Screenshots por seção da página de entrada (default: off)
  --force              Ignora cache existente e re-crawla do zero

Cache: se <out>/<site-slug>/crawl.json existir com status "complete" e sem --force,
o script reporta o cache e sai sem tocar na rede. Crawls interrompidos ficam
"partial" e são retomados de onde pararam.`;

const BLOCK_EXT = /\.(pdf|zip|rar|7z|dmg|exe|msi|png|jpe?g|gif|webp|avif|svg|ico|mp4|mp3|wav|avi|mov|webm|docx?|xlsx?|pptx?|csv|xml|rss)$/i;
const BLOCK_PATH = /(^|\/)(login|logout|signin|signup|sign-in|sign-up|register|cadastro|cart|carrinho|checkout|account|minha-conta|admin|wp-admin|wp-login|privacy|privacidade|terms|termos|cookies)(\/|$)/i;
const TRACKING_PARAMS = /^(utm_|fbclid|gclid|msclkid|mc_|ref$)/i;

function parseArgs(argv) {
  const args = {
    url: null, out: null, maxPages: 10, maxDepth: 2,
    include: null, exclude: null, maxAssets: 1500, maxImg: 400,
    timeout: 60000, wait: 'networkidle', extraWait: 1500,
    mobile: true, sections: false, force: false,
  };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--out=')) args.out = a.slice(6);
    else if (a.startsWith('--max-pages=')) args.maxPages = Number(a.split('=')[1]);
    else if (a.startsWith('--max-depth=')) args.maxDepth = Number(a.split('=')[1]);
    else if (a.startsWith('--include=')) args.include = new RegExp(a.slice(10), 'i');
    else if (a.startsWith('--exclude=')) args.exclude = new RegExp(a.slice(10), 'i');
    else if (a.startsWith('--max-assets=')) args.maxAssets = Number(a.split('=')[1]);
    else if (a.startsWith('--max-img=')) args.maxImg = Number(a.split('=')[1]);
    else if (a.startsWith('--timeout=')) args.timeout = Number(a.split('=')[1]);
    else if (a.startsWith('--wait=')) args.wait = a.slice(7);
    else if (a.startsWith('--extra-wait=')) args.extraWait = Number(a.split('=')[1]);
    else if (a === '--no-mobile') args.mobile = false;
    else if (a === '--sections') args.sections = true;
    else if (a === '--force') args.force = true;
    else if (a === '-h' || a === '--help') { console.log(USAGE); process.exit(0); }
    else if (a.startsWith('--')) { console.error(`unknown flag: ${a}`); process.exit(2); }
    else if (!args.url) args.url = a;
    else { console.error(`unexpected argument: ${a}`); process.exit(2); }
  }
  return args;
}

// --- NixOS: resolve browsers do Playwright via nix (sem export manual) ---
export function setupNixEnv() {
  // /etc/NIXOS sumiu no NixOS 26.05; /run/current-system é o marcador estável
  const isNixOS = existsSync('/etc/NIXOS') || existsSync('/run/current-system');
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
  if (!pw) throw new Error('playwright not resolvable — rode via: npx --yes --package=playwright@1.58.2 -- node crawl-site.js ...');
  const launchOpts = { headless: true };
  if (process.env.PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH) {
    launchOpts.executablePath = process.env.PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH;
  }
  return pw.chromium.launch(launchOpts);
}

// --- Normalização de links para dedup/fila ---
function normalizeLink(href, baseUrl, origin) {
  const abs = resolveUrl(baseUrl, href);
  if (!abs) return null;
  let u;
  try { u = new URL(abs); } catch { return null; }
  if (u.origin !== origin) return null;
  u.hash = '';
  for (const p of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(p)) u.searchParams.delete(p);
  }
  let s = u.toString();
  if (u.pathname !== '/' && !u.search && s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

function shouldFollow(urlStr, args) {
  let pathname;
  try { pathname = new URL(urlStr).pathname; } catch { return false; }
  if (BLOCK_EXT.test(pathname)) return false;
  if (BLOCK_PATH.test(pathname)) return false;
  if (args.exclude && args.exclude.test(pathname)) return false;
  if (args.include && !args.include.test(pathname)) return false;
  return true;
}

// --- Reescrita de refs do HTML para paths locais do cache ---
// As páginas vivem em pages/<slug>/index.html e os assets em assets/<kind>/,
// então todo path do manifest ganha o prefixo ../../
function rewriteHtml(html, assets, baseUrl) {
  const map = {};
  for (const [absUrl, info] of Object.entries(assets)) map[absUrl] = `../../${info.path}`;

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

// --- Coleta in-page: outline, links, custom props resolvidas, estilos computados, fontes ---
async function collectPageData(page) {
  return page.evaluate(() => {
    const title = document.title || '';
    const metaDescription = document.querySelector('meta[name="description"]')?.content || '';

    const headings = [...document.querySelectorAll('h1, h2, h3')].slice(0, 80).map((h) => ({
      tag: h.tagName.toLowerCase(),
      text: (h.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
    }));

    const links = [...document.querySelectorAll('a[href]')].map((a) => ({
      href: a.getAttribute('href'),
      text: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
      nav: !!a.closest('nav, header, [role="navigation"], footer'),
    }));

    // Custom properties declaradas em :root/html/body, com valor resolvido.
    // Essencial em sites Tailwind/minificados onde o CSS bruto é ilegível.
    const rootVars = {};
    const docStyle = getComputedStyle(document.documentElement);
    const walkRules = (rules) => {
      for (const r of rules) {
        try {
          if (r.cssRules) { walkRules(r.cssRules); continue; }
          if (!r.selectorText || !r.style) continue;
          if (!/(^|,)\s*(:root|html|body)\s*(,|$)/.test(r.selectorText)) continue;
          for (const prop of r.style) {
            if (prop.startsWith('--')) {
              rootVars[prop] = (docStyle.getPropertyValue(prop) || r.style.getPropertyValue(prop)).trim();
            }
          }
        } catch {}
      }
    };
    for (const sheet of document.styleSheets) {
      try { walkRules(sheet.cssRules); } catch {}
    }

    // Estilos computados de elementos-amostra (tipografia, cores, radius, motion)
    const SAMPLE_SELECTORS = {
      body: 'body',
      h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6',
      paragraph: 'main p, article p, p',
      link: 'main a[href], a[href]',
      button: 'button, [class*="btn"], [class*="button"], a[class*="cta"]',
      input: 'input:not([type=hidden]), textarea, select',
      card: '[class*="card"], [class*="Card"]',
      nav: 'nav, header',
      footer: 'footer',
    };
    const PROPS = [
      'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textTransform',
      'color', 'backgroundColor', 'backgroundImage',
      'borderRadius', 'border', 'boxShadow', 'padding', 'gap',
      'transitionProperty', 'transitionDuration', 'transitionTimingFunction',
    ];
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    const samples = {};
    for (const [key, sel] of Object.entries(SAMPLE_SELECTORS)) {
      let el = null;
      try { el = [...document.querySelectorAll(sel)].find(isVisible) || null; } catch {}
      if (!el) continue;
      const cs = getComputedStyle(el);
      const styles = {};
      for (const p of PROPS) {
        const v = cs[p];
        if (v && v !== 'none' && v !== 'normal' && v !== 'auto') styles[p] = v;
      }
      samples[key] = {
        element: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/).slice(0, 4).join('.') : ''),
        styles,
      };
    }

    let fonts = [];
    try {
      const seen = new Set();
      for (const f of document.fonts) {
        const k = `${f.family}|${f.weight}|${f.style}`;
        if (seen.has(k)) continue;
        seen.add(k);
        fonts.push({ family: f.family.replace(/['"]/g, ''), weight: f.weight, style: f.style, status: f.status });
      }
    } catch {}

    return { title, metaDescription, headings, links, rootVars, samples, fonts };
  });
}

async function captureSections(page, screenshotsDir) {
  const captured = [];
  const handles = await page.$$('main > section, body > section, section, header, footer');
  const seen = new Set();
  let idx = 0;
  for (const h of handles) {
    if (idx >= 12) break;
    try {
      const box = await h.boundingBox();
      if (!box || box.height < 150 || box.width < 300) continue;
      const key = `${Math.round(box.y)}:${Math.round(box.height)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const id = await h.evaluate((el) =>
        (el.id || el.className?.toString().trim().split(/\s+/)[0] || el.tagName.toLowerCase())
          .replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40));
      const file = `section-${String(idx).padStart(2, '0')}-${id}.png`;
      await h.screenshot({ path: join(screenshotsDir, file) });
      captured.push(file);
      idx++;
    } catch {}
  }
  return captured;
}

// --- Processa uma página: goto, coleta, screenshots, grava no cache ---
async function processPage(browser, item, ctx) {
  const { args, siteDir, assets, counters, slugsUsed, entryOrigin } = ctx;
  const slug = pageSlug(item.url, slugsUsed);
  const pageDir = join(siteDir, 'pages', slug);
  const screenshotsDir = join(pageDir, 'screenshots');
  await mkdir(screenshotsDir, { recursive: true });

  const record = {
    url: item.url, finalUrl: null, slug, title: '', depth: item.depth,
    status: null, htmlBytes: 0, screenshots: {}, error: null,
  };
  const discovered = [];

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  page.on('response', async (res) => {
    const rUrl = res.url();
    if (!/^https?:/i.test(rUrl)) return;
    let body;
    try { body = await res.body(); } catch { return; }
    if (!res.ok()) return;

    const ct = (res.headers()['content-type'] || '');
    const kind = kindFromContentType(ct, rUrl);
    if (kind === 'html') return; // documentos viram pages/, não assets

    const existing = assets[rUrl];
    if (existing) {
      if (!existing.pages.includes(slug)) existing.pages.push(slug);
      return;
    }
    if (counters.total >= args.maxAssets) { counters.droppedTotal++; return; }
    if (kind === 'img' && counters.img >= args.maxImg) { counters.droppedImg++; return; }

    const filename = safeFilenameFromUrl(rUrl, kind);
    const relPath = join('assets', kind, filename);
    try {
      await mkdir(dirname(join(siteDir, relPath)), { recursive: true });
      await writeFile(join(siteDir, relPath), body);
      assets[rUrl] = { kind, path: relPath, bytes: body.length, contentType: ct, pages: [slug] };
      counters.total++;
      if (kind === 'img') counters.img++;
    } catch {}
  });

  try {
    log(`[${item.depth}] goto ${item.url}`);
    let response = null;
    try {
      response = await page.goto(item.url, { waitUntil: args.wait, timeout: args.timeout });
    } catch (e) {
      if (args.wait === 'networkidle' && /Timeout/i.test(e.message)) {
        // networkidle nunca dispara em sites com polling — degrada para 'load'
        warn(`networkidle timeout em ${item.url}, tentando waitUntil=load`);
        response = await page.goto(item.url, { waitUntil: 'load', timeout: args.timeout });
      } else {
        throw e;
      }
    }

    record.status = response ? response.status() : null;
    record.finalUrl = page.url();
    if (record.status && record.status >= 400) {
      record.error = `http ${record.status}`;
      return { record, discovered };
    }

    if (args.extraWait > 0) await page.waitForTimeout(args.extraWait);

    const data = await collectPageData(page);
    record.title = data.title;

    // CSS cross-origin bloqueia cssRules no browser (CORS), então o walkRules
    // in-page não enxerga custom properties de CDNs. Fallback: extrai os nomes
    // do CSS já baixado e resolve os valores no browser via getComputedStyle.
    const cssVarNames = new Set();
    for (const info of Object.values(assets)) {
      if (info.kind !== 'css' || !info.pages.includes(slug)) continue;
      if (cssVarNames.size >= 3000) break;
      try {
        const css = await readFile(join(siteDir, info.path), 'utf8');
        for (const m of css.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) cssVarNames.add(m[1]);
      } catch {}
    }
    if (cssVarNames.size) {
      try {
        const resolved = await page.evaluate((names) => {
          const cs = getComputedStyle(document.documentElement);
          const out = {};
          for (const n of names) {
            const v = cs.getPropertyValue(n).trim();
            if (v) out[n] = v;
          }
          return out;
        }, [...cssVarNames]);
        data.rootVars = { ...resolved, ...data.rootVars };
      } catch {}
    }

    try {
      await page.screenshot({ path: join(screenshotsDir, 'desktop.png'), fullPage: true });
      record.screenshots.desktop = 'screenshots/desktop.png';
    } catch (e) { warn(`screenshot desktop falhou (${slug}): ${e.message.split('\n')[0]}`); }

    if (args.sections && item.depth === 0) {
      const sections = await captureSections(page, screenshotsDir);
      if (sections.length) record.screenshots.sections = sections.map((f) => `screenshots/${f}`);
    }

    if (args.mobile) {
      try {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(screenshotsDir, 'mobile.png'), fullPage: true });
        record.screenshots.mobile = 'screenshots/mobile.png';
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.waitForTimeout(300);
      } catch (e) { warn(`screenshot mobile falhou (${slug}): ${e.message.split('\n')[0]}`); }
    }

    const html = await page.content();
    record.htmlBytes = Buffer.byteLength(html, 'utf8');
    await writeFile(join(pageDir, 'index.html'), rewriteHtml(html, assets, record.finalUrl));

    // Classifica links descobertos para a fila + registro de auditoria
    const followed = [];
    const ignored = [];
    const seenHere = new Set();
    for (const l of data.links) {
      const norm = normalizeLink(l.href, record.finalUrl, entryOrigin);
      if (!norm) { ignored.push({ href: l.href, reason: 'external-or-invalid' }); continue; }
      if (seenHere.has(norm)) continue;
      seenHere.add(norm);
      if (!shouldFollow(norm, args)) { ignored.push({ href: norm, reason: 'blocklist' }); continue; }
      followed.push({ url: norm, nav: l.nav, text: l.text });
      discovered.push({ url: norm, depth: item.depth + 1, nav: l.nav });
    }

    await writeFile(join(pageDir, 'page.json'), JSON.stringify({
      url: item.url, finalUrl: record.finalUrl, slug, depth: item.depth,
      title: data.title, metaDescription: data.metaDescription,
      headings: data.headings,
      links: { followed, ignored: ignored.slice(0, 100) },
    }, null, 2));

    await writeFile(join(pageDir, 'computed.json'), JSON.stringify({
      url: record.finalUrl,
      rootVars: data.rootVars,
      samples: data.samples,
      fonts: data.fonts,
    }, null, 2));
  } catch (e) {
    record.error = e.message.split('\n')[0];
    warn(`falha em ${item.url}: ${record.error}`);
  } finally {
    await context.close();
  }

  return { record, discovered };
}

function summarize(crawl, siteDir, cached = false) {
  log('');
  log(`=== ${cached ? 'Cache existente' : 'Resultado'} ===`);
  for (const p of crawl.pages) {
    const icon = p.error ? '✗' : '✓';
    log(`${icon} [${p.depth}] ${p.url} → ${p.slug} | ${p.status ?? 'ERR'} | ${fmtBytes(p.htmlBytes)}${p.error ? ` | ${p.error}` : ''}`);
  }
  log(`pages: ${crawl.totals.pages} | assets: ${crawl.totals.assetsOk} ok (${fmtBytes(crawl.totals.bytes)})`);
  log(`cache: ${siteDir}`);
  console.log(JSON.stringify({ cached, cacheDir: siteDir, status: crawl.status, totals: crawl.totals }));
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.url || !/^https?:\/\//i.test(args.url)) { console.error(USAGE); process.exit(2); }

  const rootOut = resolve(args.out || join(process.cwd(), '.ds-cache'));
  const slug = siteSlug(args.url);
  const siteDir = join(rootOut, slug);
  const crawlJsonPath = join(siteDir, 'crawl.json');
  const entryOrigin = new URL(args.url).origin;

  // --- Cache hit / resume ---
  let crawl = null;
  if (existsSync(crawlJsonPath) && !args.force) {
    try { crawl = JSON.parse(await readFile(crawlJsonPath, 'utf8')); } catch {}
    if (crawl?.status === 'complete') {
      if (args.maxPages > crawl.pages.length && crawl.queue?.length) {
        warn(`cache tem ${crawl.pages.length} páginas mas --max-pages=${args.maxPages}; use --force para re-crawlar com mais páginas`);
      }
      summarize(crawl, siteDir, true);
      return;
    }
    if (crawl?.status === 'partial') log(`retomando crawl parcial (${crawl.pages.length} páginas já no cache)`);
  }
  if (args.force) await rm(siteDir, { recursive: true, force: true });

  await mkdir(siteDir, { recursive: true });

  // --- Estado (novo ou retomado) ---
  const assets = {};
  const counters = { total: 0, img: 0, droppedTotal: 0, droppedImg: 0 };
  const assetsManifestPath = join(siteDir, 'assets', 'manifest.json');
  if (crawl && existsSync(assetsManifestPath)) {
    try {
      Object.assign(assets, JSON.parse(await readFile(assetsManifestPath, 'utf8')).assets || {});
      for (const a of Object.values(assets)) {
        counters.total++;
        if (a.kind === 'img') counters.img++;
      }
    } catch {}
  }

  const visited = new Set();
  const slugsUsed = new Set();
  const pages = [];
  let queue = [];
  if (crawl?.status === 'partial') {
    for (const p of crawl.pages) {
      visited.add(p.url);
      slugsUsed.add(p.slug);
      pages.push(p);
    }
    queue = (crawl.queue || []).filter((q) => !visited.has(q.url));
  } else {
    const entry = normalizeLink(args.url, args.url, entryOrigin) || args.url;
    queue = [{ url: entry, depth: 0, nav: false }];
  }

  const optionsUsed = {
    maxPages: args.maxPages, maxDepth: args.maxDepth,
    include: args.include?.source || null, exclude: args.exclude?.source || null,
    maxAssets: args.maxAssets, maxImg: args.maxImg,
    wait: args.wait, extraWait: args.extraWait, mobile: args.mobile, sections: args.sections,
  };

  const saveState = async (status) => {
    const totals = {
      pages: pages.length,
      assetsOk: Object.keys(assets).length,
      bytes: Object.values(assets).reduce((s, a) => s + a.bytes, 0),
      droppedAssets: counters.droppedTotal,
      droppedImages: counters.droppedImg,
    };
    const data = {
      sourceUrl: args.url, siteSlug: slug, startedAt: crawl?.startedAt || startedAt,
      finishedAt: status === 'complete' ? new Date().toISOString() : null,
      status, options: optionsUsed, pages, queue, totals,
    };
    await writeFile(crawlJsonPath, JSON.stringify(data, null, 2));
    await mkdir(dirname(assetsManifestPath), { recursive: true });
    await writeFile(assetsManifestPath, JSON.stringify({ assets }, null, 2));
    return data;
  };

  const startedAt = new Date().toISOString();
  log(`site: ${args.url} → ${siteDir}`);
  log(`limites: ${args.maxPages} páginas, depth ${args.maxDepth}`);

  const browser = await launchBrowser();
  const ctx = { args, siteDir, assets, counters, slugsUsed, entryOrigin };

  try {
    while (queue.length > 0 && pages.length < args.maxPages) {
      const item = queue.shift();
      if (visited.has(item.url)) continue;
      visited.add(item.url);

      const { record, discovered } = await processPage(browser, item, ctx);
      pages.push(record);

      if (!record.error && item.depth < args.maxDepth) {
        // nav primeiro dentro do mesmo nível: garante que as páginas estruturais
        // (menu) entram antes de links de conteúdo profundo
        const fresh = discovered.filter((d) => !visited.has(d.url) && !queue.some((q) => q.url === d.url));
        const navLinks = fresh.filter((d) => d.nav);
        const rest = fresh.filter((d) => !d.nav);
        queue.push(...navLinks, ...rest);
        queue.sort((a, b) => a.depth - b.depth || (b.nav === true) - (a.nav === true));
      }

      await saveState('partial');
    }
  } finally {
    await browser.close();
  }

  const finalData = await saveState('complete');
  summarize(finalData, siteDir);
}

main().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
