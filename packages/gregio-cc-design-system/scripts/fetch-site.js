#!/usr/bin/env node
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { log, warn, hostSlug, pLimit, loadUrls, fmtBytes } from './shared.js';
import { fetchWithCheerio, analyzeSpa } from './cheerio-fetch.js';
import { fetchWithPlaywright, launchBrowser } from './playwright-fetch.js';

const USAGE = `Usage:
  node fetch-site.js <url...> [options]
  node fetch-site.js --file=urls.txt [options]

Options:
  --file=<path>            Arquivo com URLs (1 por linha, # = comentário)
  --out=<dir>              Pasta raiz de saída (default: ./ds-fetch no CWD)
  --spa                    Força playwright direto (pula cheerio)
  --no-spa                 Nunca usa playwright (cheerio only)
  --max-assets=<n>         Total máximo de assets por URL (default: 800)
  --max-img=<n>            Máximo de imagens por URL (default: 200)
  --concurrency=<n>        URLs processadas em paralelo (default: 3)
  --screenshot             Salvar screenshot (só em modo playwright)
  --timeout=<ms>           Timeout do goto (default: 60000)

Comportamento padrão (sem --spa nem --no-spa):
  1. Tenta com cheerio primeiro (rápido, sem browser)
  2. Analisa o HTML — se detectar SPA (body vazio, #root/#app sem filhos) → retenta com playwright
  3. Mantém o melhor resultado`;

function parseArgs(argv) {
  const args = {
    urls: [],
    file: null,
    out: null,
    spa: null,
    maxAssets: 800,
    maxImg: 200,
    concurrency: 3,
    screenshot: false,
    timeout: 60000,
  };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--file=')) args.file = a.slice('--file='.length);
    else if (a.startsWith('--out=')) args.out = a.slice('--out='.length);
    else if (a === '--spa') args.spa = true;
    else if (a === '--no-spa') args.spa = false;
    else if (a.startsWith('--max-assets=')) args.maxAssets = Number(a.split('=')[1]);
    else if (a.startsWith('--max-img=')) args.maxImg = Number(a.split('=')[1]);
    else if (a.startsWith('--concurrency=')) args.concurrency = Number(a.split('=')[1]);
    else if (a === '--screenshot') args.screenshot = true;
    else if (a.startsWith('--timeout=')) args.timeout = Number(a.split('=')[1]);
    else if (a === '-h' || a === '--help') { console.log(USAGE); process.exit(0); }
    else if (a.startsWith('--')) { console.error(`unknown flag: ${a}`); process.exit(2); }
    else args.urls.push(a);
  }
  return args;
}

async function processUrl(url, rootOut, args, browserRef) {
  const slug = hostSlug(url);
  const outDir = join(rootOut, slug);
  const sharedOpts = { maxAssets: args.maxAssets, maxImg: args.maxImg };

  // --spa: vai direto pro playwright
  if (args.spa === true) {
    const browser = await ensureBrowser(browserRef);
    return fetchWithPlaywright(browser, url, outDir, {
      ...sharedOpts, timeout: args.timeout, screenshot: args.screenshot,
    });
  }

  // Tenta cheerio primeiro
  const cheerioResult = await fetchWithCheerio(url, outDir, sharedOpts);

  if (cheerioResult.error) {
    log(`cheerio falhou para ${url}: ${cheerioResult.error}`);
    return cheerioResult;
  }

  // --no-spa: não tenta playwright
  if (args.spa === false) return cheerioResult;

  // Auto-detect: se parece SPA, retenta com playwright
  if (cheerioResult.spa && cheerioResult.spa.suspect) {
    log(`SPA detectado em ${url} (${cheerioResult.spa.reasons.join('; ')}) → tentando com playwright...`);
    try {
      const browser = await ensureBrowser(browserRef);
      // Limpa o diretório cheerio antes de reescrever com playwright
      await rm(outDir, { recursive: true, force: true });
      const pwResult = await fetchWithPlaywright(browser, url, outDir, {
        ...sharedOpts, timeout: args.timeout, screenshot: args.screenshot,
      });
      if (!pwResult.error) return pwResult;
      warn(`playwright falhou para ${url}: ${pwResult.error} — mantendo resultado cheerio`);
    } catch (e) {
      warn(`playwright indisponível: ${e.message} — mantendo resultado cheerio`);
    }
    // Refaz cheerio se o diretório foi limpo mas playwright falhou
    return fetchWithCheerio(url, outDir, sharedOpts);
  }

  return cheerioResult;
}

async function ensureBrowser(ref) {
  if (!ref.browser) ref.browser = await launchBrowser();
  return ref.browser;
}

async function main() {
  const args = parseArgs(process.argv);
  const urls = await loadUrls(args);
  if (urls.length === 0) { console.error(USAGE); process.exit(2); }

  const rootOut = resolve(args.out || join(process.cwd(), 'ds-fetch'));
  await mkdir(rootOut, { recursive: true });
  log(`output: ${rootOut}`);
  log(`processing ${urls.length} url(s) — mode: ${args.spa === true ? 'playwright' : args.spa === false ? 'cheerio-only' : 'auto'}`);

  const browserRef = { browser: null };

  let results;
  try {
    results = await pLimit(urls, args.concurrency, (u) =>
      processUrl(u, rootOut, args, browserRef)
    );
  } finally {
    if (browserRef.browser) await browserRef.browser.close();
  }

  // Sumário
  const summary = results.map((r) => ({
    url: r.url,
    mode: r.mode,
    status: r.status,
    htmlBytes: r.htmlBytes,
    assetsOk: r.assetsOk,
    assetsFailed: r.assetsFailed,
    durationMs: r.durationMs,
    error: r.error,
    outDir: r.outDir,
    spa: r.spa,
  }));

  await writeFile(join(rootOut, 'summary.json'), JSON.stringify(summary, null, 2));

  // Print sumário
  log('');
  log('=== Resultado ===');
  for (const r of results) {
    const icon = r.error ? '✗' : '✓';
    const spa = r.spa?.suspect ? ' [SPA]' : '';
    log(`${icon} ${r.url} → ${r.mode} | ${r.status || 'ERR'} | ${fmtBytes(r.htmlBytes)} html | ${r.assetsOk} assets | ${r.durationMs}ms${spa}`);
    if (r.error) log(`  erro: ${r.error}`);
  }
  log(`output: ${rootOut}`);
}

main().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
