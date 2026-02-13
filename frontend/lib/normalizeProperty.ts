export type AnyObj = Record<string, any>;

export type PropertyNormalized = {
  id: string;
  title: string;
  location: string;
  areaLabel: string; // e.g., UB6
  price: number | null;

  bedrooms: number | null;
  bathrooms: number | null;

  yieldPct: number | null;
  roiPct: number | null;

  rentPcm: number | null;
  rentSource: string | null;

  imageUrl: string | null;

  raw: AnyObj;
};

function isFiniteNumber(v: any): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function parseNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (isFiniteNumber(v)) return v;
  const s = String(v).replace(/[,£$]/g, '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function getAreaFromLocation(location: string) {
  // Quick heuristic: last token that looks like UK postcode outward (e.g. UB6, IG3, TW8)
  const tokens = (location || '').split(/\s+/).filter(Boolean);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i].replace(/[,]/g, '');
    if (/^[A-Z]{1,2}\d[A-Z\d]?$/.test(t)) return t;
    if (/^[A-Z]{1,2}\d{1,2}$/.test(t)) return t;
  }
  return '';
}

/**
 * IMPORTANT:
 * Scraped properties + placeholders use different field names.
 * This normalization makes Saved Deals + Quick Stats + Score logic consistent.
 */
export function normalizeProperty(p: AnyObj): PropertyNormalized {
  const id = String(p?.id || p?.uuid || p?.property_id || '');

  const title =
    p?.title ||
    p?.display_title ||
    p?.address ||
    p?.headline ||
    'Untitled property';

  const location =
    p?.location ||
    p?.area ||
    p?.postcode ||
    p?.town ||
    p?.city ||
    p?.address ||
    '';

  const areaLabel =
    p?.postcode_outward ||
    p?.postcodeArea ||
    getAreaFromLocation(location) ||
    '';

  const price =
    parseNumber(p?.price) ??
    parseNumber(p?.price_gbp) ??
    parseNumber(p?.asking_price) ??
    null;

  const bedrooms =
    parseNumber(p?.bedrooms) ??
    parseNumber(p?.beds) ??
    parseNumber(p?.num_bedrooms) ??
    null;

  const bathrooms =
    parseNumber(p?.bathrooms) ??
    parseNumber(p?.baths) ??
    parseNumber(p?.num_bathrooms) ??
    null;

  const yieldPct =
    parseNumber(p?.yield_percent) ??
    parseNumber(p?.yieldPct) ??
    parseNumber(p?.yield) ??
    parseNumber(p?.rental_yield) ??
    parseNumber(p?.rentalYield) ??
    parseNumber(p?.rental_yield_percent) ??
    null;

  const roiPct =
    parseNumber(p?.roi_percent) ??
    parseNumber(p?.roiPct) ??
    parseNumber(p?.roi) ??
    parseNumber(p?.roi_pct) ??
    parseNumber(p?.roiPercent) ??
    parseNumber(p?.roi_percentage) ??
    null;

  const rentPcm =
    parseNumber(p?.rent_pcm) ??
    parseNumber(p?.rent_per_month) ??
    parseNumber(p?.rent_monthly) ??
    parseNumber(p?.rent_estimate) ??
    parseNumber(p?.rent) ??
    null;

  const rentSource =
    p?.rent_source ||
    p?.rentSource ||
    (rentPcm ? 'Proxy' : null);

  const imageUrl =
    p?.imageurl ||
    p?.image_url ||
    p?.image ||
    (Array.isArray(p?.images) && p.images.length ? p.images[0] : null) ||
    null;

  return {
    id,
    title: String(title),
    location: String(location),
    areaLabel: String(areaLabel),
    price,
    bedrooms,
    bathrooms,
    yieldPct,
    roiPct,
    rentPcm,
    rentSource: rentSource ? String(rentSource) : null,
    imageUrl: imageUrl ? String(imageUrl) : null,
    raw: p,
  };
}
