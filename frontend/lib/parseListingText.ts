const UK_POSTCODE_REGEX = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

export type ParsedListingDetails = {
  title?: string;
  description?: string;
  postcode?: string;
  price?: number;
  estimatedMonthlyRent?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
};

const PROPERTY_TYPE_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\bmaisonette\b/i, value: 'Maisonette' },
  { pattern: /\bbungalow\b/i, value: 'Bungalow' },
  { pattern: /\bsemi[-\s]?detached\b/i, value: 'Semi-detached' },
  { pattern: /\bdetached\b/i, value: 'Detached' },
  { pattern: /\bterraced?\b/i, value: 'Terraced' },
  { pattern: /\b(flat|apartment)\b/i, value: 'Flat' },
];

function cleanAmount(raw: string): number | undefined {
  const normalized = raw.replace(/[^\d.]/g, '');
  if (!normalized) return undefined;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

function normalizeTitleLine(line: string): string | undefined {
  const trimmed = line.trim().replace(/^[-*•\s]+/, '');
  if (!trimmed || trimmed.length < 6) return undefined;
  if (/^(price|rent|description|summary|details|features?)\b/i.test(trimmed)) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return undefined;
  return trimmed.slice(0, 240);
}

function findPurchasePrice(text: string): number | undefined {
  const explicitMatch = text.match(
    /(?:asking price|guide price|offers? (?:in excess of|over)|fixed price|purchase price|price)\D{0,20}(£\s?[\d,]+(?:\.\d+)?)/i,
  );
  if (explicitMatch) return cleanAmount(explicitMatch[1]);

  const amountPattern = /£\s?[\d,]+(?:\.\d+)?/gi;
  for (const match of text.matchAll(amountPattern)) {
    const amount = cleanAmount(match[0]);
    if (!amount || amount < 10_000) continue;

    const start = match.index ?? 0;
    const before = text.slice(Math.max(0, start - 32), start);
    const after = text.slice(start + match[0].length, start + match[0].length + 32);
    const hasRentContext = /(?:rent|rental|monthly rent)\s*[:\-]?\s*$/i.test(before)
      || /^\s*(?:pcm|per calendar month|per month|monthly|pw|per week)\b/i.test(after);

    if (!hasRentContext) return amount;
  }

  return undefined;
}

export function looksLikeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeUkPostcode(value: string): string | undefined {
  const match = value.match(UK_POSTCODE_REGEX);
  if (!match) return undefined;
  const compact = match[1].replace(/\s+/g, '').toUpperCase();
  if (compact.length < 5) return undefined;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function parseListingText(input: string): ParsedListingDetails {
  const text = input.trim();
  if (!text) return {};

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const firstUsefulLine = lines.map(normalizeTitleLine).find(Boolean);
  const postcode = normalizeUkPostcode(text);

  const rentMatch = text.match(/(?:pcm|per calendar month|per month|monthly rent)\D{0,12}(£\s?[\d,]+(?:\.\d+)?)/i)
    || text.match(/(£\s?[\d,]+(?:\.\d+)?)\s*(?:pcm|per calendar month|per month)/i);
  const bedroomMatch = text.match(/\b(\d{1,2})\s*(?:bed|beds|bedroom|bedrooms)\b/i);
  const bathroomMatch = text.match(/\b(\d{1,2})\s*(?:bath|baths|bathroom|bathrooms)\b/i);

  const propertyType = PROPERTY_TYPE_PATTERNS.find(({ pattern }) => pattern.test(text))?.value;

  return {
    title: firstUsefulLine,
    description: text.slice(0, 4000),
    postcode,
    price: findPurchasePrice(text),
    estimatedMonthlyRent: rentMatch ? cleanAmount(rentMatch[1]) : undefined,
    bedrooms: bedroomMatch ? Number(bedroomMatch[1]) : undefined,
    bathrooms: bathroomMatch ? Number(bathroomMatch[1]) : undefined,
    propertyType,
  };
}
