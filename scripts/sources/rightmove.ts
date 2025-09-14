// scripts/sources/rightmove.ts
// Robust Rightmove scraper: tries HTML cards first, then embedded JSON blobs.

import { load } from 'cheerio';

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

const PAGE_SIZE = 24;
const MAX_PAGES = 5;
const REQUEST_DELAY_MS = 650;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parsePrice(raw: string): number {
  const m = raw.replace(/[, ]/g, '').match(/£?(\d+(?:\.\d+)?)/i);
  return m ? Number(m[1]) : 0;
}

function firstTruthy(...vals: Array<string | null | undefined>): string {
  for (const v of vals) if (v && v.trim()) return v.trim();
  return '';
}

function extractIdFromHref(href: string): string | null {
  const m1 = href.match(/\/properties\/(\d+)/i);
  if (m1) return m1[1];
  const m2 = href.match(/property-(\d+)/i);
  if (m2) return m2[1];
  return null;
}

function extractBeds(text: string): number | null {
  const m = text.toLowerCase().match(/(\d+)\s*bed/);
  return m ? Number(m[1]) : null;
}
function extractBaths(text: string): number | null {
  const m = text.toLowerCase().match(/(\d+)\s*bath/);
  return m ? Number(m[1]) : null;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'en-GB,en;q=0.9',
      Referer: 'https://www.rightmove.co.uk/',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

/* -------------------- Parser A: scrape HTML cards -------------------- */
function parseHtmlCards(html: string): RMItem[] {
const $ = load(html);

  const cards =
    $('[data-testid="propertyCard"]').toArray().length
      ? $('[data-testid="propertyCard"]').toArray()
      : $('.l-searchResult').toArray();

  const out: RMItem[] = [];

  for (const card of cards) {
    const href =
      $(card).find('a[href*="/properties/"]').attr('href') ||
      $(card).find('a.propertyCard-link').attr('href') ||
      $(card).find('a').attr('href') ||
      '';

    const id = extractIdFromHref(href);
    if (!id) continue;

    const title =
      $(card).find('[data-testid="propertyCard-title"]').text().trim() ||
      $(card).find('h2').first().text().trim() ||
      $(card).find('.propertyCard-title').text().trim() ||
      `Property ${id}`;

    const location =
      $(card).find('[data-testid="propertyCard-address"]').text().trim() ||
      $(card).find('.propertyCard-address').text().trim() ||
      $(card).find('.propertyCard-subtitle').text().trim() ||
      '';

    const priceRaw =
      $(card).find('[data-testid="price"]').text().trim() ||
      $(card).find('.propertyCard-priceValue').text().trim() ||
      $(card).find('.propertyCard-price').text().trim() ||
      '';
    const price = parsePrice(priceRaw);

    const features =
      $(card).find('[data-testid="property-features"]').text().trim() ||
      $(card).find('.propertyCard-tags').text().trim() ||
      $(card).find('.propertyCard-branchSummary').text().trim() ||
      title;

    const bedrooms = extractBeds(features) ?? extractBeds(title);
    const bathrooms = extractBaths(features);

    const img =
      $(card).find('img').attr('src') ||
      $(card).find('img').attr('data-src') ||
      $(card).find('img').attr('data-lazy-src') ||
      null;

    out.push({
      source: 'rightmove',
      source_id: id,
      title,
      location,
      price,
      bedrooms: bedrooms ?? null,
      bathrooms: bathrooms ?? null,
      imageurl: img,
      latitude: null,
      longitude: null,
    });
  }

  return out;
}

/* -------------------- Parser B: embedded JSON fallbacks -------------------- */
function tryParseEmbeddedJson(html: string): RMItem[] {
  // Rightmove often ships JSON in window.jsonModel or __NEXT_DATA__ / __PRELOADED_STATE__
  const blobs: string[] = [];

  const jsonModel = html.match(/window\.jsonModel\s*=\s*({.*?});\s*<\/script>/s);
  if (jsonModel) blobs.push(jsonModel[1]);

  const nextData = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>\s*({[\s\S]*?})\s*<\/script>/s);
  if (nextData) blobs.push(nextData[1]);

  const preloaded = html.match(/window\.__PRELOADED_STATE__\s*=\s*({.*?});\s*<\/script>/s);
  if (preloaded) blobs.push(preloaded[1]);

  const items: RMItem[] = [];

  for (const blob of blobs) {
    try {
      const data = JSON.parse(blob);

      // A few shapes we’ve met in the wild:
      const listings =
        // jsonModel: { properties: [...] }
        (data && Array.isArray(data.properties) && data.properties) ||
        // next data: { props: { pageProps: { searchResults: { properties: [...] }}}}
        data?.props?.pageProps?.searchResults?.properties ||
        // preloaded: { results: { properties: [...] } }
        data?.results?.properties;

      if (!Array.isArray(listings)) continue;

      for (const p of listings) {
        const id =
          String(p.id || p.propertyId || p.propertyIdFormatted || '').replace(/\D/g, '') ||
          null;
        if (!id) continue;

        const title =
          p.title ||
          p.propertyTypeFull ||
          p.propertySubType ||
          `Property ${id}`;

        const address =
          p.displayAddress || p.address || p.location || p.shortAddress || '';

        const price =
          parsePrice(String(p.price?.amount || p.price?.display || p.price || ''));

        const bedrooms =
          (typeof p.bedrooms === 'number' ? p.bedrooms : null) ??
          extractBeds(String(p.summary || p.title || ''));

        const bathrooms =
          (typeof p.bathrooms === 'number' ? p.bathrooms : null) ??
          extractBaths(String(p.summary || ''));

        const img =
          p.primaryImageUrl ||
          p.imageUrl ||
          p.image?.src ||
          null;

        items.push({
          source: 'rightmove',
          source_id: id,
          title: String(title),
          location: String(address),
          price: Number(price || 0),
          bedrooms: bedrooms ?? null,
          bathrooms: bathrooms ?? null,
          imageurl: img ?? null,
          latitude: p.location?.latitude ?? null,
          longitude: p.location?.longitude ?? null,
        });
      }
    } catch {
      // ignore this blob and try the next
    }
  }

  return items;
}

/* -------------------- Public: scrape with pagination -------------------- */
export async function scrapeRightmove(baseUrl: string, maxPages = MAX_PAGES): Promise<RMItem[]> {
  const u = new URL(baseUrl);
  const all: RMItem[] = [];

  for (let page = 0; page < maxPages; page++) {
    u.searchParams.set('index', String(page * PAGE_SIZE));

    const html = await fetchHtml(u.toString());

    // Strategy A
    let items = parseHtmlCards(html);

    // Strategy B (fallback) if Strategy A found nothing
    if (items.length === 0) {
      items = tryParseEmbeddedJson(html);
    }

    if (items.length === 0) {
      // nothing on this page — bail out early
      break;
    }

    all.push(...items);

    if (items.length < PAGE_SIZE) break; // likely the last page
    await sleep(REQUEST_DELAY_MS);
  }

  // Deduplicate by source_id
  const map = new Map<string, RMItem>();
  for (const it of all) map.set(it.source_id, it);
  return [...map.values()];
}