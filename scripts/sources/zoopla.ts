// scripts/sources/zoopla.ts
// Zoopla scraper with enhanced data capture features.
// Enhanced with property_type extraction, image quality ranking, and detail page scraping.
import * as cheerio from 'cheerio';
import { request } from 'undici';

export type ScrapedItem = {
  source: 'zoopla';
  source_id: string;          // stable id from the site
  title: string;
  location: string;
  price: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  property_type?: string | null;
  description?: string | null;
  imageurl?: string | null;
  image_urls?: string[];
  latitude?: number | null;
  longitude?: number | null;
  detail_url?: string | null;
};

const DEBUG = process.env.ZP_DEBUG === '1' || process.env.ZP_DEBUG === 'true';
const SCRAPE_DETAILS = (process.env.ZP_SCRAPE_DETAILS ?? '0') === '1';
const DELAY_MS = Number(process.env.ZP_DELAY_MS ?? '1200');

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

// Extract and rank images, preferring higher resolution
function extractImages(root: cheerio.Cheerio<cheerio.Element>): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  root.find('img').each((_, el) => {
    const $el = cheerio.load(el)('img');
    const src = $el.attr('src') || $el.attr('data-src') || $el.attr('data-lazy-src') || '';
    if (src && !seen.has(src)) {
      if (!isPlaceholderImage(src)) {
        seen.add(src);
        images.push(src);
      }
    }

    const srcset = $el.attr('srcset') || '';
    if (srcset) {
      const srcsetUrls = parseSrcSet(srcset);
      srcsetUrls.forEach(url => {
        if (!seen.has(url) && !isPlaceholderImage(url)) {
          seen.add(url);
          images.push(url);
        }
      });
    }
  });

  return rankImagesByQuality(images);
}

function parseSrcSet(srcset: string): string[] {
  const urls: string[] = [];
  const entries = srcset.split(',');
  for (const entry of entries) {
    const parts = entry.trim().split(/\s+/);
    if (parts.length > 0) {
      urls.push(parts[0]);
    }
  }
  return urls;
}

function isPlaceholderImage(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('placeholder') ||
    lower.includes('blank') ||
    lower.includes('1x1') ||
    lower.includes('pixel') ||
    lower.match(/\d+x\d+/) && parseInt(lower.match(/(\d+)x/)?.[1] || '0') < 100
  );
}

function rankImagesByQuality(urls: string[]): string[] {
  return urls.sort((a, b) => {
    const sizeA = extractImageSize(a);
    const sizeB = extractImageSize(b);
    return sizeB - sizeA;
  });
}

function extractImageSize(url: string): number {
  const match = url.match(/(\d+)x(\d+)/);
  if (match) {
    const width = parseInt(match[1]);
    const height = parseInt(match[2]);
    return width * height;
  }
  return 0;
}

function extractPropertyType(root: cheerio.Cheerio<cheerio.Element>): string | null {
  const typeText = 
    root.find('[data-testid="property-type"]').first().text().trim() ||
    root.find('.propertyCard-propertyType').first().text().trim() ||
    root.find('.listing-property-type').first().text().trim() ||
    '';

  if (!typeText) return null;

  return extractPropertyTypeFromText(typeText);
}

function extractPropertyTypeFromText(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('flat') || lower.includes('apartment')) return 'flat';
  if (lower.includes('detached') && !lower.includes('semi')) return 'detached';
  if (lower.includes('semi-detached')) return 'semi-detached';
  if (lower.includes('terraced')) return 'terraced';
  if (lower.includes('bungalow')) return 'bungalow';
  if (lower.includes('house')) return 'house';
  if (lower.includes('studio')) return 'studio';
  return text;
}

async function scrapeDetailPage(detailUrl: string): Promise<{ description?: string; property_type?: string; images?: string[] }> {
  try {
    const { body } = await request(detailUrl, { method: 'GET' });
    const html = await body.text();
    const $ = cheerio.load(html);
    
    // Extract full description from detail page
    const description =
      $('[data-testid="listing-description"], .listing-description, [itemprop="description"]')
        .first()
        .text()
        .trim() || undefined;

    // Extract property type from detail page
    const propertyTypeEl = 
      $('[data-testid="property-type"], .property-type, .listing-property-type')
        .first()
        .text()
        .trim();
    const property_type = propertyTypeEl ? extractPropertyTypeFromText(propertyTypeEl) : undefined;

    // Extract all images from detail page
    const images: string[] = [];
    const seen = new Set<string>();
    $('img').each((_, el) => {
      const $el = $(el);
      const src = $el.attr('src') || $el.attr('data-src') || '';
      if (src && !seen.has(src) && !isPlaceholderImage(src)) {
        seen.add(src);
        images.push(src);
      }
    });

    return {
      description: description && description.length > 20 ? description : undefined,
      property_type,
      images: images.length > 0 ? rankImagesByQuality(images) : undefined,
    };
  } catch (err) {
    if (DEBUG) console.warn(`  ⚠ Failed to scrape detail page: ${err}`);
    return {};
  }
}

export async function scrapezoopla(searchUrl: string): Promise<ScrapedItem[]> {
  const { body } = await request(searchUrl, { method: 'GET' });
  const html = await body.text();

  const $ = cheerio.load(html);
  const items: ScrapedItem[] = [];

  // NOTE: selectors are intentionally defensive; zoopla markup can change.
  $('.l-searchResult').each((_, el) => {
    const root = $(el);

    const id = root.attr('id')?.replace(/\D+/g, '') || '';
    if (!id) return;

    // Extract detail URL
    const href = root.find('a').attr('href') || '';
    const detail_url = href.startsWith('http')
      ? href
      : href.startsWith('/')
        ? `https://www.zoopla.co.uk${href}`
        : href
          ? `https://www.zoopla.co.uk/${href}`
          : null;

    const title = root.find('.propertyCard-title').text().trim() ||
                  root.find('[data-testid="title"]').text().trim();

    const location = root.find('.propertyCard-address').text().trim() ||
                     root.find('[data-testid="address"]').text().trim();

    const priceText = root.find('.propertyCard-priceValue').text().replace(/[^\d]/g, '');
    const price = priceText ? Number(priceText) : 0;

    // beds/baths are often embedded in the summary list; keep it best-effort
    const summary = root.find('.propertyCard-branchSummary, .property-information').text();
    const beds = /(\d+)\s*bed/i.exec(summary)?.[1];
    const baths = /(\d+)\s*bath/i.exec(summary)?.[1];

    // Extract property type
    const property_type = extractPropertyType(root);

    // Extract description
    const description = root.find('.propertyCard-description, [data-testid="description"]')
      .first()
      .text()
      .trim() || null;

    // Extract and rank images
    const image_urls = extractImages(root);
    const img = image_urls.length > 0 ? image_urls[0] : null;

    items.push({
      source: 'zoopla',
      source_id: id,
      title: title || `zoopla listing ${id}`,
      location,
      price,
      bedrooms: beds ? Number(beds) : null,
      bathrooms: baths ? Number(baths) : null,
      property_type,
      description,
      imageurl: img,
      image_urls,
      latitude: null,   // keep null unless you have a reliable selector
      longitude: null,
      detail_url,
    });
  });

  // Optionally scrape detail pages for enhanced data
  if (SCRAPE_DETAILS) {
    for (const item of items) {
      if (item.detail_url) {
        if (DEBUG) console.log(`  · fetching detail page for ${item.source_id}`);
        const details = await scrapeDetailPage(item.detail_url);
        
        // Enhance with detail page data
        if (details.description && (!item.description || details.description.length > item.description.length)) {
          item.description = details.description;
        }
        if (details.property_type && !item.property_type) {
          item.property_type = details.property_type;
        }
        if (details.images && details.images.length > 0) {
          const allImages = [...(item.image_urls || []), ...details.images];
          const uniqueImages = Array.from(new Set(allImages));
          item.image_urls = rankImagesByQuality(uniqueImages);
          item.imageurl = item.image_urls[0] || item.imageurl;
        }
        
        await sleep(DELAY_MS);
      }
    }
  }

  return items;
}
