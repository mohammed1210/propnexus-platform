// scripts/sources/rightmove.ts
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
  imageurl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

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

    const title = root.find('.propertyCard-title').text().trim() ||
                  root.find('[data-testid="title"]').text().trim();

    const location = root.find('.propertyCard-address').text().trim() ||
                     root.find('[data-testid="address"]').text().trim();

    const priceText = root.find('.propertyCard-priceValue').text().replace(/[^\d]/g, '');
    const price = priceText ? Number(priceText) : 0;

    const img = root.find('img').attr('src') || root.find('img').attr('data-src') || null;

    // beds/baths are often embedded in the summary list; keep it best-effort
    const summary = root.find('.propertyCard-branchSummary, .property-information').text();
    const beds = /(\d+)\s*bed/i.exec(summary)?.[1];
    const baths = /(\d+)\s*bath/i.exec(summary)?.[1];

    items.push({
      source: 'zoopla',
      source_id: id,
      title: title || `zoopla listing ${id}`,
      location,
      price,
      bedrooms: beds ? Number(beds) : null,
      bathrooms: baths ? Number(baths) : null,
      imageurl: img,
      latitude: null,   // keep null unless you have a reliable selector
      longitude: null,
    });
  });

  return items;
}
