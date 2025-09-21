// scripts/sources/rightmove.ts
// Rightmove scraper with gateway selection, JS-render toggle and retries.

import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

export type RMItem = {
  source: 'rightmove';
  source_id: string;
  title: string;
  location: string;
  price: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  imageurl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const DEBUG     = process.env.RM_DEBUG === '1' || process.env.RM_DEBUG === 'true';
const MAX_PAGES = Number(process.env.RM_MAX_PAGES ?? '1');
const DELAY_MS  = Number(process.env.RM_DELAY_MS  ?? '1200');
const RENDER    = (process.env.RM_RENDER ?? '1') === '1'; // allow disabling JS rendering
const PROVIDER  = (process.env.SCRAPER_PROVIDER ?? 'auto').toLowerCase(); // auto|zenrows|scraperapi|scrapingbee

// ---------- helpers ----------
function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }
function ensureDebugDir() {
  const dir = path.resolve(process.cwd(), '.scrape_debug');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function saveDebugHtml(html: string, name: string) {
  if (!DEBUG) return;
  const dir = ensureDebugDir();
  fs.writeFileSync(path.join(dir, `${name}.html`), html, 'utf8');
}
function pageUrl(baseUrl: string, page: number) {
  const u = new URL(baseUrl);
  const index = page * 24; // RM uses 24/page
  u.searchParams.set('index', String(index));
  return u.toString();
}
function looksLikeCookieWall(html: string) {
  const t = html.toLowerCase();
  return t.includes('cookie') && t.includes('consent');
}

// ---------- providers (URLs only; we pass our own headers when direct) ----------
const ZENROWS = process.env.ZENROWS_API_KEY ? {
  name: 'zenrows',
  url: (target: string, render: boolean) =>
    `https://api.zenrows.com/v1/?apikey=${process.env.ZENROWS_API_KEY}` +
    `&url=${encodeURIComponent(target)}${render ? '&js_render=true' : ''}&premium_proxy=true`,
} : null;

const SCRAPERAPI = process.env.SCRAPERAPI_KEY ? {
  name: 'scraperapi',
  url: (target: string, render: boolean) =>
    `https://api.scraperapi.com/?api_key=${process.env.SCRAPERAPI_KEY}` +
    `&url=${encodeURIComponent(target)}&country_code=gb` +
    (render ? '&render=true&device_type=desktop' : ''),
} : null;

const SCRAPINGBEE = process.env.SCRAPINGBEE_KEY ? {
  name: 'scrapingbee',
  url: (target: string, render: boolean) =>
    `https://app.scrapingbee.com/api/v1/?api_key=${process.env.SCRAPINGBEE_KEY}` +
    `&url=${encodeURIComponent(target)}&country_code=gb${render ? '&render_js=true' : ''}`,
} : null;

// Select in priority order depending on SCRAPER_PROVIDER
function pickProviders() {
  const avail = [ZENROWS, SCRAPERAPI, SCRAPINGBEE].filter(Boolean) as {
    name: string; url: (t: string, r: boolean) => string
  }[];

  if (PROVIDER === 'auto') return avail;
  return avail.filter(p => p.name === PROVIDER);
}

const UA =
  process.env.RM_HEADERS_UA ??
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const DIRECT_HEADERS: Record<string, string> = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Upgrade-Insecure-Requests': '1',
  'Cookie': 'OptanonAlertBoxClosed=1',
};

// Try provider(s) -> if all fail, try direct (non-rendered) as last resort
async function fetchHtmlChain(targetUrl: string) {
  const providers = pickProviders();
  const attempts: { where: string; status: number; size: number }[] = [];

  // 1) try configured providers with RENDER flag
  for (const p of providers) {
    const url = p.url(targetUrl, RENDER);
    const res = await fetch(url, { redirect: 'follow' });
    const html = await res.text();
    attempts.push({ where: p.name + (RENDER ? '+render' : ''), status: res.status, size: html.length });

    if (DEBUG) console.log(`  [${p.name}] HTTP ${res.status} size=${html.length.toLocaleString()}B`);
    if (res.ok && html.length > 10000 && !looksLikeCookieWall(html)) {
      return { provider: p.name, status: res.status, html };
    }
    // ScraperAPI returns 402 when plan lacks rendering or quota exceeded
    if (res.status === 402 || res.status === 429 || res.status >= 500) continue;
  }

  // 2) as a fallback, try same providers WITHOUT JS rendering (cheaper and sometimes works)
  for (const p of providers) {
    const url = p.url(targetUrl, false);
    const res = await fetch(url, { redirect: 'follow' });
    const html = await res.text();
    attempts.push({ where: p.name + '+nojs', status: res.status, size: html.length });

    if (DEBUG) console.log(`  [${p.name} nojs] HTTP ${res.status} size=${html.length.toLocaleString()}B`);
    if (res.ok && html.length > 10000 && !looksLikeCookieWall(html)) {
      return { provider: p.name + ':nojs', status: res.status, html };
    }
  }

  // 3) direct (no proxy) last
  const res = await fetch(targetUrl, { headers: DIRECT_HEADERS, redirect: 'follow' });
  const html = await res.text();
  attempts.push({ where: 'direct', status: res.status, size: html.length });
  if (DEBUG) console.log(`  [direct] HTTP ${res.status} size=${html.length.toLocaleString()}B`);

  return { provider: 'direct', status: res.status, html, attempts };
}

function parsePrice(s: string): number {
  const n = Number((s || '').replace(/[^0-9]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function parseIntFromText(s: string): number | null {
  const m = (s || '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function parseCards(html: string): RMItem[] {
  const $ = cheerio.load(html);
  const out: RMItem[] = [];

  // Try multiple selectors (RM changes classnames often).
  $('[data-testid="propertyCard"], [data-test="property-card"], .propertyCard').each((i, el) => {
    const root = $(el);

    const href = root.find('a').attr('href') || '';
    const idMatch = href.match(/properties\/(\d+)/i);
    const source_id = idMatch?.[1] ?? `u_${i}`;

    const title =
      root.find('h2, [data-testid=title]').first().text().trim() ||
      root.find('[itemprop=name]').first().text().trim() ||
      'Property';

    const location =
      root.find('[data-testid=address], [itemprop=address]').first().text().trim() ||
      root.find('.propertyCard-address').first().text().trim() ||
      '';

    const priceText =
      root.find('[data-testid=price], .propertyCard-priceValue').first().text().trim() || '';
    const price = parsePrice(priceText);

    const bedText =
      root.find('[data-testid=bed], [data-testid=bedrooms]').first().text().trim() ||
      root.find('.propertyCard-branchSummary').text();
    const bedrooms = parseIntFromText(bedText);

    const bathText =
      root.find('[data-testid=baths], [data-testid=bathrooms]').first().text().trim() || '';
    const bathrooms = parseIntFromText(bathText);

    const img =
      root.find('img').attr('src') ||
      root.find('img').attr('data-src') || null;

    out.push({
      source: 'rightmove',
      source_id,
      title,
      location,
      price,
      bedrooms: Number.isFinite(bedrooms) ? bedrooms : null,
      bathrooms: Number.isFinite(bathrooms) ? bathrooms : null,
      imageurl: img,
      latitude: null,
      longitude: null,
    });
  });

  return out;
}

export async function scrapeRightmove(searchUrl: string): Promise<RMItem[]> {
  const all: RMItem[] = [];

  for (let p = 0; p < MAX_PAGES; p++) {
    const url = pageUrl(searchUrl, p);
    const { provider, status, html } = await fetchHtmlChain(url);

    if (DEBUG) {
      saveDebugHtml(html, `rightmove-${provider}-page-${p}`);
      console.log(`  [HTTP ${status}] provider=${provider} page size=${html.length.toLocaleString()}B`);
    }

    if (status >= 400) {
      console.warn(`  ⚠ HTTP ${status}; stopping`);
      break;
    }
    if (looksLikeCookieWall(html)) {
      console.warn('  ⚠ page looks like a bot / cookie wall.');
      break;
    }

    const items = parseCards(html);
    if (DEBUG) console.log(`  · parsed ${items.length} items on page ${p}`);
    all.push(...items);

    if (items.length === 0) break;
    if (p < MAX_PAGES - 1) await sleep(DELAY_MS);
  }

  return all;
}