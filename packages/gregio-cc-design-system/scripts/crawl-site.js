#!/usr/bin/env node
// Crawler Playwright-only para extração de design systems.
// Baixa um site multi-página (BFS, mesma origem, nav primeiro) num cache local
// estruturado e reutilizável — ver references/cache-layout.md para o contrato.
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import {
  loadOptional, log, warn, resolveUrl, kindFromContentType,
  safeFilenameFromUrl, siteSlug, pageSlug, fmtBytes,
} from './shared.js';

const USAGE = `Usage:
  node crawl-site.js <url> [options]

Options:
  --out=<dir>          Raiz do cache (default: ~/.ds-cache — global, compartilhado
                       entre projetos). Site vai em <out>/<site-slug>/
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
  --click=<selector>   Clica no seletor (se visível) após o load de CADA página,
                       antes da captura. Repetível (cliques em sequência). Para
                       atravessar gates de região/idade/cookies. O cookie/estado
                       resultante persiste no crawl inteiro (context compartilhado).
  --click-wait=<ms>    Espera após cada clique (default: 1500)
  --force              Ignora cache existente e re-crawla do zero

Cache: se <out>/<site-slug>/crawl.json existir com status "complete" e sem --force,
o script reporta o cache e sai sem tocar na rede — EXCETO quando as opções pedidas
são mais amplas que as do cache (max-pages/max-depth maiores, clicks/include/exclude
diferentes, sections/mobile recém-ligados): aí re-crawla automaticamente, logando o
motivo. Re-crawl e --force apagam só crawl.json/pages/assets — workspaces de
pipeline em <site>/apps/ são preservados. Crawls interrompidos ficam "partial" e
são retomados de onde pararam.`;

const BLOCK_EXT = /\.(pdf|zip|rar|7z|dmg|exe|msi|png|jpe?g|gif|webp|avif|svg|ico|mp4|mp3|wav|avi|mov|webm|docx?|xlsx?|pptx?|csv|xml|rss)$/i;
const BLOCK_PATH = /(^|\/)(login|logout|signin|signup|sign-in|sign-up|register|cadastro|cart|carrinho|checkout|account|minha-conta|admin|wp-admin|wp-login|privacy|privacidade|terms|termos|cookies)(\/|$)/i;
const TRACKING_PARAMS = /^(utm_|fbclid|gclid|msclkid|mc_|ref$)/i;

function parseArgs(argv) {
  const args = {
    url: null, out: null, maxPages: 10, maxDepth: 2,
    include: null, exclude: null, maxAssets: 1500, maxImg: 400,
    timeout: 60000, wait: 'networkidle', extraWait: 1500,
    mobile: true, sections: false, force: false,
    clicks: [], clickWait: 1500,
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
    else if (a.startsWith('--click=')) args.clicks.push(a.slice(8));
    else if (a.startsWith('--click-wait=')) args.clickWait = Number(a.split('=')[1]);
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

// --- Ícones do site (favicon, apple-touch, mask-icon, webmanifest) ---
// Browsers headless não requisitam favicons, então o listener de response
// nunca os vê — busca explícita via context.request, só na entry page.
// Essencial para o DS gerado configurar ícones iOS/Android/Safari.
async function captureIcons(page, siteDir, assets, entryOrigin) {
  const context = page.context();
  const baseUrl = page.url();

  const declared = await page.evaluate(() => {
    const out = [...document.querySelectorAll('link[rel*="icon" i], link[rel="manifest"], link[rel="mask-icon"]')]
      .map((l) => ({
        rel: (l.getAttribute('rel') || '').toLowerCase(),
        href: l.getAttribute('href'),
        sizes: l.getAttribute('sizes') || null,
        type: l.getAttribute('type') || null,
        color: l.getAttribute('color') || null,
      }));
    const tile = document.querySelector('meta[name="msapplication-TileImage"]');
    if (tile?.content) out.push({ rel: 'msapplication-tileimage', href: tile.content, sizes: null, type: null, color: null });
    return out;
  });

  // Convenções que existem mesmo sem <link> declarado
  const candidates = [...declared];
  const declaredAbs = new Set(declared.map((d) => resolveUrl(baseUrl, d.href)).filter(Boolean));
  for (const [path, rel] of [['/favicon.ico', 'icon'], ['/apple-touch-icon.png', 'apple-touch-icon']]) {
    const abs = entryOrigin + path;
    if (!declaredAbs.has(abs)) candidates.push({ rel, href: abs, sizes: null, type: null, color: null, conventional: true });
  }

  const icons = [];
  // while indexado: ícones do webmanifest são acrescentados durante o loop
  for (let i = 0; i < candidates.length && i < 40; i++) {
    const c = candidates[i];
    const abs = resolveUrl(baseUrl, c.href);
    if (!abs) continue;

    let res;
    try { res = await context.request.get(abs, { timeout: 15000 }); } catch { continue; }
    if (!res.ok()) continue;
    const body = await res.body();
    const ct = (res.headers()['content-type'] || '');

    if (c.rel === 'manifest' || /manifest\+json|\.webmanifest/i.test(ct + abs)) {
      try {
        const man = JSON.parse(body.toString('utf8'));
        for (const mi of man.icons || []) {
          candidates.push({
            rel: 'manifest-icon', href: resolveUrl(abs, mi.src),
            sizes: mi.sizes || null, type: mi.type || null, purpose: mi.purpose || null,
          });
        }
        const filename = safeFilenameFromUrl(abs, 'json');
        const relPath = join('assets', 'icon', filename);
        await mkdir(dirname(join(siteDir, relPath)), { recursive: true });
        await writeFile(join(siteDir, relPath), body);
        icons.push({ rel: 'manifest', url: abs, path: relPath, sizes: null, type: 'application/manifest+json' });
      } catch {}
      continue;
    }

    // ícone binário: rejeita respostas html (404 disfarçado de página)
    if (ct.includes('text/html')) continue;
    const filename = safeFilenameFromUrl(abs, 'img');
    const relPath = join('assets', 'icon', filename);
    try {
      await mkdir(dirname(join(siteDir, relPath)), { recursive: true });
      await writeFile(join(siteDir, relPath), body);
    } catch { continue; }
    if (!assets[abs]) assets[abs] = { kind: 'icon', path: relPath, bytes: body.length, contentType: ct, pages: ['home'] };
    icons.push({
      rel: c.rel, url: abs, path: relPath,
      sizes: c.sizes, type: c.type || ct || null,
      ...(c.color ? { color: c.color } : {}),
      ...(c.purpose ? { purpose: c.purpose } : {}),
      ...(c.conventional ? { conventional: true } : {}),
    });
  }

  if (icons.length) log(`[icons] ${icons.length} capturados (favicon/apple-touch/manifest)`);
  return icons;
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
// Recebe o context COMPARTILHADO do crawl: cookies/localStorage persistem entre
// páginas — essencial para sites com gate (região/idade) atravessado via --click.
async function processPage(context, item, ctx) {
  const { args, siteDir, assets, counters, slugsUsed, entryOrigin } = ctx;
  const slug = pageSlug(item.url, slugsUsed);
  const pageDir = join(siteDir, 'pages', slug);
  const screenshotsDir = join(pageDir, 'screenshots');
  await mkdir(screenshotsDir, { recursive: true });

  const record = {
    url: item.url, finalUrl: null, slug, title: '', depth: item.depth,
    status: null, htmlBytes: 0, screenshots: {}, clicksApplied: [], error: null,
  };
  const discovered = [];

  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

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

    // Gates (região/idade/cookies): clica no primeiro match VISÍVEL de cada
    // seletor, em ordem. O mesmo seletor pode casar elementos ocultos (ex.: o
    // item do dropdown do header além do botão do gate) — por isso não basta
    // .first(). Idempotente: com o cookie persistido no context, o gate não
    // reaparece e nada é clicado.
    for (const sel of args.clicks) {
      try {
        const candidates = await page.locator(sel).all();
        for (const loc of candidates) {
          if (!(await loc.isVisible().catch(() => false))) continue;
          await loc.click({ timeout: 3000 });
          record.clicksApplied.push(sel);
          log(`[click] ${sel} em ${slug}`);
          // O clique pode disparar navegação (gate que recarrega com o
          // conteúdo): dá tempo dela começar e espera assentar.
          await page.waitForTimeout(500);
          await page.waitForLoadState('load', { timeout: args.timeout }).catch(() => {});
          await page.waitForTimeout(args.clickWait);
          break;
        }
      } catch {}
    }

    let data;
    try {
      data = await collectPageData(page);
    } catch (e) {
      if (/Execution context was destroyed/i.test(e.message)) {
        // navegação tardia pós-clique — espera e tenta uma vez mais
        await page.waitForLoadState('load', { timeout: args.timeout }).catch(() => {});
        await page.waitForTimeout(args.extraWait);
        data = await collectPageData(page);
      } else {
        throw e;
      }
    }
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

    if (item.depth === 0) {
      ctx.icons.push(...await captureIcons(page, siteDir, assets, entryOrigin));
    }

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
    await page.close();
  }

  return { record, discovered };
}

function summarize(crawl, siteDir, { cached = false, recrawled = false, reasons = [] } = {}) {
  log('');
  log(`=== ${cached ? 'Cache existente' : 'Resultado'} ===`);
  for (const p of crawl.pages) {
    const icon = p.error ? '✗' : '✓';
    log(`${icon} [${p.depth}] ${p.url} → ${p.slug} | ${p.status ?? 'ERR'} | ${fmtBytes(p.htmlBytes)}${p.error ? ` | ${p.error}` : ''}`);
  }
  log(`pages: ${crawl.totals.pages} | assets: ${crawl.totals.assetsOk} ok (${fmtBytes(crawl.totals.bytes)})`);
  log(`cache: ${siteDir}`);
  console.log(JSON.stringify({ cached, recrawled, reasons, cacheDir: siteDir, status: crawl.status, totals: crawl.totals }));
}

// Opções pedidas pedem MAIS conteúdo do que o cache tem? Cada motivo retorna
// uma string legível. Opções mais estreitas não invalidam o cache (superset).
function broadenedReasons(crawl, args) {
  const cached = crawl.options || {};
  const r = [];
  // mais páginas só rende algo se o crawl anterior foi truncado (fila sobrou)
  if (args.maxPages > (cached.maxPages ?? Infinity) && (crawl.queue?.length || 0) > 0) {
    r.push(`max-pages ${cached.maxPages} → ${args.maxPages}`);
  }
  // mais profundidade sempre pode render: links no nível-limite nunca entraram na fila
  if (args.maxDepth > (cached.maxDepth ?? Infinity)) {
    r.push(`max-depth ${cached.maxDepth} → ${args.maxDepth}`);
  }
  if (JSON.stringify(args.clicks) !== JSON.stringify(cached.clicks || [])) {
    r.push(`clicks ${JSON.stringify(cached.clicks || [])} → ${JSON.stringify(args.clicks)}`);
  }
  if ((args.include?.source || null) !== (cached.include ?? null)) r.push('include diferente');
  if ((args.exclude?.source || null) !== (cached.exclude ?? null)) r.push('exclude diferente');
  if (args.sections && !cached.sections) r.push('sections ligado');
  if (args.mobile && cached.mobile === false) r.push('mobile ligado');
  // caches de versões antigas do crawler não têm ícones (favicon/apple-touch)
  if (!Array.isArray(crawl.icons)) r.push('cache de versão antiga (sem ícones)');
  return r;
}

// Remove SÓ os artefatos de crawl — <site>/apps/ guarda workspaces de pipeline
// (ds-spec.md, analysis/) de runs que não podem ser perdidos num re-crawl.
async function clearCrawlArtifacts(siteDir) {
  for (const entry of ['crawl.json', 'pages', 'assets']) {
    await rm(join(siteDir, entry), { recursive: true, force: true });
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.url || !/^https?:\/\//i.test(args.url)) { console.error(USAGE); process.exit(2); }

  const rootOut = resolve(args.out || join(homedir(), '.ds-cache'));
  const slug = siteSlug(args.url);
  const siteDir = join(rootOut, slug);
  const crawlJsonPath = join(siteDir, 'crawl.json');
  const entryOrigin = new URL(args.url).origin;

  // --- Cache hit / re-crawl automático / resume ---
  let crawl = null;
  let recrawlReasons = [];
  if (existsSync(crawlJsonPath) && !args.force) {
    try { crawl = JSON.parse(await readFile(crawlJsonPath, 'utf8')); } catch {}
    if (crawl) {
      recrawlReasons = broadenedReasons(crawl, args);
      if (recrawlReasons.length > 0) {
        // opções pedem mais que o cache tem → re-crawl automático do zero
        log(`re-crawl automático: opções ampliadas (${recrawlReasons.join('; ')})`);
        crawl = null;
      } else if (crawl.status === 'complete') {
        summarize(crawl, siteDir, { cached: true });
        return;
      } else if (crawl.status === 'partial') {
        log(`retomando crawl parcial (${crawl.pages.length} páginas já no cache)`);
      }
    }
  }
  if (args.force || recrawlReasons.length > 0) await clearCrawlArtifacts(siteDir);

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
    clicks: args.clicks, clickWait: args.clickWait,
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
      status, options: optionsUsed, icons: ctx.icons, pages, queue, totals,
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
  // Context único para o crawl inteiro: cookies/localStorage (gates de região,
  // consentimento) persistem entre páginas — uma página nova por URL.
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  });
  const ctx = { args, siteDir, assets, counters, slugsUsed, entryOrigin, icons: [] };
  if (crawl?.status === 'partial' && Array.isArray(crawl.icons)) ctx.icons.push(...crawl.icons);

  try {
    while (queue.length > 0 && pages.length < args.maxPages) {
      const item = queue.shift();
      if (visited.has(item.url)) continue;
      visited.add(item.url);

      const { record, discovered } = await processPage(context, item, ctx);
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
  summarize(finalData, siteDir, { recrawled: recrawlReasons.length > 0, reasons: recrawlReasons });
}

main().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
