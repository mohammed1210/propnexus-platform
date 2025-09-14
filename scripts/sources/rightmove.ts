// scripts/sources/rightmove.ts
// Robust Rightmove scraper: tries HTML cards; uses a scraping gateway if available.

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

const DEBUG = process.env.RM_DEBUG === '1' || process.env.RM_DEBUG === 'true';
const MAX_PAGES = Number(process.env.RM_MAX_PAGES ?? '1');
const DELAY_MS  = Number(process.env.RM_DELAY_MS  ?? '1200');

// ---- Gateway(s) ------------------------------------------------------------
// const ZENROWS = process.env.ZENROWS_API_KEY ? {
//   url: (target: string) =>
//     `https://api.zenrows.com/v1/?apikey=${process.env.ZENROWS_API_KEY}&url=${encodeURIComponent(target)}&premium_proxy=true&js_render=true`,
// } : null;

const SCRAPERAPI = process.env.SCRAPERAPI_KEY ? {
  url: (target: string) =>
    `https://api.scraperapi.com/?api_key=${process.env.SCRAPERAPI_KEY}&render=true&country_code=uk&url=${encodeURIComponent(target)}`,
} : null;

const SCRAPINGBEE = process.env.SCRAPINGBEE_KEY ? {
  url: (target: string) =>
    `https://app.scrapingbee.com/api/v1/?api_key=${process.env.SCRAPINGBEE_KEY}&render_js=true&country_code=gb&url=${encodeURIComponent(target)}`,
} : null;

const GATEWAY = SCRAPERAPI ?? SCRAPINGBEE ?? null;

// ---- Fallback headers (no gateway) ----------------------------------------
const UA =
  process.env.RM_HEADERS_UA ??
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const BASE_HEADERS: Record<string, string> = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Upgrade-Insecure-Requests': '1',
  'Cookie': 'OptanonAlertBoxClosed=1; OptanonConsent=isIABGlobal=false&datestamp=2024-01-01T00:00:00.000Z',
};

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

// --- URL Normaliser ---------------------------------------------------------
function normaliseRMUrl(u: string) {
  try {
    const url = new URL(u);
    if (url.pathname.endsWith('/search.html')) {
      url.pathname = url.pathname.replace('/search.html', '/find.html');
    }
    return url.toString();
  } catch {
    return u;
  }
}

function pageUrl(baseUrl: string, page: number) {
  const u = new URL(normaliseRMUrl(baseUrl)); // 👈 ensure correct endpoint
  const index = page * 24; // RM paginates by 24
  u.searchParams.set('index', String(index));
  return u.toString();
}

function looksLikeCookieWall(html: string) {
  const t = html.toLowerCase();
  return t.includes('cookie') && t.includes('consent');
}

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

async function fetchHtml(url: string) {
  const target = GATEWAY ? GATEWAY.url(url) : url;
  const res = await fetch(target, { headers: GATEWAY ? {} : BASE_HEADERS, redirect: 'follow' });
  const html = await res.text();
  if (DEBUG) console.log(`  [HTTP ${res.status}] page size=${html.length.toLocaleString()}B`);
  return { status: res.status, html };
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
    const { status, html } = await fetchHtml(url);

    if (DEBUG) saveDebugHtml(html, `rightmove-page-${p}`);

    if (status >= 400) {
      console.warn(`  ⚠ HTTP ${status}; stopping`);
      break;
    }
    if (looksLikeCookieWall(html) && !GATEWAY) {
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