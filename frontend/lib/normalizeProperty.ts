export type AnyObj = Record<string, any>;

export type PropertyNormalized = {
  id: string;
  title: string;
  location: string;
  price: number | null;
  rentMonthly: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  yieldPercent: number | null;
  /** Real ROI only (if explicitly present in the source data). */
  roiPercent: number | null;
  /** Proxy ROI used for scoring/optional labeled display when real ROI is missing. */
  roiProxyPercent: number | null;
  roiIsProxy: boolean;
  imageUrl: string | null;
  area: string | null;

  /** Legacy aliases kept for compatibility across the codebase. */
  areaLabel: string;
  yieldPct: number | null;
  roiPct: number | null;
  rentPcm: number | null;
  rentSource: string | null;

  raw: AnyObj;
};


function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clampYieldLikePercent(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  // Optional but recommended: avoid showing insane values.
  if (n < 0 || n > 25) return null;
  return round1(n);
}

function clampRoiLikePercent(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  // ROI can be negative or substantially higher than yield.
  if (n < -100 || n > 200) return null;
  return round1(n);
}

function getScoreInputs(p: AnyObj): AnyObj | null {
  const a = p?.score_breakdown;
  if (a && typeof a === 'object') {
    const inputs = (a as any)?.inputs;
    if (inputs && typeof inputs === 'object') return inputs as AnyObj;
  }

  const b = p?.scoreBreakdown;
  if (b && typeof b === 'object') {
    const inputs = (b as any)?.inputs;
    if (inputs && typeof inputs === 'object') return inputs as AnyObj;
  }
  return null;
}

function proxyYieldFromRentAndPrice(p: any): number | null {
  const price = typeof p?.price === 'number' ? p.price : null;
  const rent =
    typeof p?.rent_monthly === 'number'
      ? p.rent_monthly
      : typeof p?.rentMonthly === 'number'
        ? p.rentMonthly
        : typeof p?.rent_pcm === 'number'
          ? p.rent_pcm
          : typeof p?.rentPcm === 'number'
            ? p.rentPcm
            : null;

  if (!price || !rent || price <= 0 || rent <= 0) return null;
  const pct = (rent * 12 * 100) / price;
  return Number.isFinite(pct) ? pct : null;
}

/**
 * Canonical Yield fallback order (must be consistent across UI):
 * 1) p.yield_percent
 * 2) p.score_breakdown.inputs.yield_percent
 * 3) compute from rent_monthly + price
 */
export function getYieldPercent(p: AnyObj): number | null {
  if (!p || typeof p !== 'object') return null;

  const scoreInputs = getScoreInputs(p);

  // 1) p.yield_percent
  const direct = parsePercent((p as any).yield_percent ?? (p as any).yieldPercent ?? (p as any).yieldPct);
  const directClamped = direct == null ? null : clampYieldLikePercent(direct);
  if (directClamped != null) return directClamped;

  // 2) p.score_breakdown.inputs.yield_percent
  const fromScore = scoreInputs ? parsePercent((scoreInputs as any).yield_percent) : null;
  const fromScoreClamped = fromScore == null ? null : clampYieldLikePercent(fromScore);
  if (fromScoreClamped != null) return fromScoreClamped;

  // 3) proxy from rent+price
  const proxy = proxyYieldFromRentAndPrice(p);
  return typeof proxy === 'number' ? clampYieldLikePercent(proxy) : null;
}

/**
 * Canonical REAL ROI fallback order (must be consistent across UI):
 * 1) p.roi_percent
 * 2) p.score_breakdown.inputs.roi_percent
 * 3) else null
 */
export function getRoiPercent(p: AnyObj): number | null {
  if (!p || typeof p !== 'object') return null;

  const scoreInputs = getScoreInputs(p);

  // 1) p.roi_percent
  // Note: intentionally does NOT read `roiPct` because in normalized objects that can be a proxy.
  const direct = parsePercent((p as any).roi_percent ?? (p as any).roiPercent);
  const directClamped = direct == null ? null : clampRoiLikePercent(direct);
  if (directClamped != null) return directClamped;

  // 2) p.score_breakdown.inputs.roi_percent
  const fromScore = scoreInputs ? parsePercent((scoreInputs as any).roi_percent) : null;
  const fromScoreClamped = fromScore == null ? null : clampRoiLikePercent(fromScore);
  if (fromScoreClamped != null) return fromScoreClamped;

  return null;
}

/**
 * Proxy ROI for explicitly-labeled display.
 * Default proxy source = yield-like proxy (canonical yield fallback order).
 */
export function getRoiProxyPercent(p: AnyObj): number | null {
  const real = getRoiPercent(p);
  if (real != null) return real;

  const proxyYield = getYieldPercent(p);
  return typeof proxyYield === 'number' ? clampRoiLikePercent(proxyYield) : null;
}

export function formatPercent(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 'N/A';
  return `${round1(n).toFixed(1)}%`;
}


function isFiniteNumber(v: any): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function firstNumberFromString(raw: string): number | null {
  const s = String(raw)
    .replace(/\u00A0/g, ' ')
    .replace(/[,]/g, '')
    .trim();
  if (!s) return null;
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function normalizeFractionalPercent(n: number, source: unknown): number {
  // Heuristic: scraped feeds sometimes store 0.089 instead of 8.9.
  // If the value looks fractional and there's no explicit % in the source, treat as a fraction.
  const src = typeof source === 'string' ? source : '';
  if (n > 0 && n < 1 && !src.includes('%')) return n * 100;
  return n;
}

export function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (isFiniteNumber(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value
      .replace(/\b(price|asking|list(?:ing)?|rent|pcm|per\s*month|per\s*week|pw|pa)\b/gi, ' ')
      .replace(/[£$€]/g, ' ')
      .replace(/\s+/g, ' ');
    return firstNumberFromString(cleaned);
  }
  return null;
}

export function parsePercent(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (isFiniteNumber(value)) return normalizeFractionalPercent(value, value);
  if (typeof value === 'string') {
    const cleaned = value
      .replace(/\b(yield|roi|return|gross|net)\b/gi, ' ')
      .replace(/[%]/g, ' ')
      .replace(/\s+/g, ' ');
    const n = firstNumberFromString(cleaned);
    return n == null ? null : normalizeFractionalPercent(n, value);
  }
  return null;
}

export function parseRent(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (isFiniteNumber(value)) return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    const n = parseMoney(value);
    if (n == null) return null;
    if (/(\bpw\b|per\s*week)/.test(lower)) return (n * 52) / 12;
    if (/(\bpa\b|per\s*annum|per\s*year)/.test(lower)) return n / 12;
    return n;
  }
  return parseMoney(value);
}

function parseCount(value: unknown): number | null {
  const n = value == null ? null : isFiniteNumber(value) ? value : typeof value === 'string' ? firstNumberFromString(value) : null;
  if (n == null) return null;
  const rounded = Math.round(n);
  return Number.isFinite(rounded) ? rounded : null;
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

  const scoreInputs: AnyObj | null =
    (p?.score_breakdown && typeof p.score_breakdown === 'object' && (p.score_breakdown as any)?.inputs && typeof (p.score_breakdown as any).inputs === 'object'
      ? (p.score_breakdown as any).inputs
      : null) ||
    (p?.scoreBreakdown && typeof p.scoreBreakdown === 'object' && (p.scoreBreakdown as any)?.inputs && typeof (p.scoreBreakdown as any).inputs === 'object'
      ? (p.scoreBreakdown as any).inputs
      : null);

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

  const area =
    (typeof p?.area_key === 'string' && p.area_key.trim()) ||
    (typeof p?.area === 'string' && p.area.trim()) ||
    (areaLabel ? String(areaLabel) : null);

  const price =
    parseMoney(p?.price) ??
    parseMoney(p?.price_gbp) ??
    parseMoney(p?.asking_price) ??
    parseMoney(p?.askingPrice) ??
    parseMoney(p?.listing_price) ??
    parseMoney(p?.listingPrice) ??
    null;

  const bedrooms =
    parseCount(p?.bedrooms) ??
    parseCount(p?.beds) ??
    parseCount(p?.bed_count) ??
    parseCount(p?.bedCount) ??
    parseCount(p?.num_bedrooms) ??
    null;

  const bathrooms =
    parseCount(p?.bathrooms) ??
    parseCount(p?.baths) ??
    parseCount(p?.bath_count) ??
    parseCount(p?.bathCount) ??
    parseCount(p?.num_bathrooms) ??
    null;

  let yieldPercent =
    parsePercent(p?.yield_percent) ??
    parsePercent(p?.yieldPercent) ??
    parsePercent(p?.yieldPct) ??
    parsePercent(p?.yield) ??
    parsePercent(p?.yield_percent_gross) ??
    parsePercent(p?.gross_yield) ??
    parsePercent(p?.grossYield) ??
    parsePercent(p?.rental_yield) ??
    parsePercent(p?.rentalYield) ??
    parsePercent(p?.rental_yield_percent) ??
    parsePercent(p?.rentalYieldPercent) ??
    parsePercent(p?.rental_yield_pct) ??
    null;

  // Fallback order: score_breakdown.inputs.yield_percent
  if (yieldPercent == null) {
    yieldPercent =
      parsePercent(scoreInputs?.yield_percent) ??
      parsePercent(scoreInputs?.yieldPercent) ??
      parsePercent(scoreInputs?.yield_pct) ??
      null;
  }

  const roiFlag = Boolean(p?.roi_is_proxy ?? p?.roiIsProxy);

  let roiPercent =
    parsePercent(p?.roi_percent) ??
    parsePercent(p?.roiPercent) ??
    parsePercent(p?.roiPct) ??
    parsePercent(p?.roi) ??
    parsePercent(p?.roi_pct) ??
    parsePercent(p?.roi_percentage) ??
    parsePercent(p?.roiPercentage) ??
    null;

  // Fallback order: score_breakdown.inputs.roi_percent
  if (roiPercent == null) {
    roiPercent =
      parsePercent(scoreInputs?.roi_percent) ??
      parsePercent(scoreInputs?.roiPercent) ??
      parsePercent(scoreInputs?.roi_pct) ??
      null;
  }

  const rentMonthly =
    parseRent(p?.rent) ??
    parseRent(p?.rent_pcm) ??
    parseRent(p?.rentPcm) ??
    parseRent(p?.rent_per_month) ??
    parseRent(p?.rentPerMonth) ??
    parseRent(p?.rent_monthly) ??
    parseRent(p?.rentMonthly) ??
    parseRent(p?.monthly_rent) ??
    parseRent(p?.monthlyRent) ??
    parseRent(p?.monthly_rent_estimate) ??
    parseRent(p?.monthlyRentEstimate) ??
    parseRent(p?.estimated_rent) ??
    parseRent(p?.rent_estimate) ??
    parseRent(p?.rentEstimate) ??
    // Fallback order: score_breakdown.inputs.rent_monthly
    parseRent(scoreInputs?.rent_monthly) ??
    parseRent(scoreInputs?.rentMonthly) ??
    parseRent(scoreInputs?.rent_pcm) ??
    parseRent(scoreInputs?.rentPcm) ??
    null;

  const rentSource =
    p?.rent_source ||
    p?.rentSource ||
    scoreInputs?.rent_source ||
    scoreInputs?.rentSource ||
    (rentMonthly ? 'Proxy' : null);

  const imageUrl =
    p?.imageurl ||
    p?.imageUrl ||
    p?.image_url ||
    p?.thumbnail ||
    p?.image ||
    (Array.isArray(p?.images) && p.images.length ? p.images[0] : null) ||
    (Array.isArray(p?.photos) && p.photos.length ? p.photos[0] : null) ||
    null;

  // Fallback yield calculation (only if missing and rent+price exist)
  if (yieldPercent == null && typeof rentMonthly === 'number' && rentMonthly > 0 && typeof price === 'number' && price > 0) {
    yieldPercent = (rentMonthly * 12 * 100) / price;
  }

  // ROI is NOT yield. Keep real ROI separate from a proxy value.
  // - roiPercent: real ROI only (if present)
  // - roiProxyPercent: used for scoring/optional labeled display
  const roiProxyPercent = roiPercent ?? yieldPercent;
  const roiIsProxy = roiFlag || (roiPercent == null && roiProxyPercent != null);

  const yieldPct = yieldPercent;
  // Legacy alias: historically used throughout the app for scoring/display.
  // Keep it aligned with the proxy so existing scoring continues to work.
  const roiPct = roiProxyPercent;
  const rentPcm = rentMonthly;

  return {
    id,
    title: String(title),
    location: String(location),
    price,
    rentMonthly,
    bedrooms,
    bathrooms,
    yieldPercent,
    roiPercent,
    roiProxyPercent,
    roiIsProxy,
    imageUrl: imageUrl ? String(imageUrl) : null,
    area: area ? String(area) : null,

    areaLabel: String(areaLabel),
    yieldPct,
    roiPct,
    rentPcm,
    rentSource: rentSource ? String(rentSource) : null,
    raw: p,
  };
}
