import { fmtGBP } from '@/lib/format';
import { formatPercent } from '@/lib/normalizeProperty';

export type InvestmentDescriptionInput = {
  title?: string | null;
  location?: string | null;
  propertyType?: string | null;
  investmentType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  price?: number | null;
  yieldPercent?: number | null;
  roiPercent?: number | null;
  roiIsProxy?: boolean;
  aiScore?: number | null;
  dealQuality?: string | null;
  strategyFit?: string | null;
  description?: string | null;
};

export type InvestmentDescriptionOutput = {
  paragraph: string;
  keySignals: string[];
  checks: string[];
  originalNotes: string;
};

const MAX_SIGNALS = 5;
const MAX_CHECKS = 3;

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[•·]/g, ' • ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(value: unknown, maxLength = 280): string {
  const clean = cleanText(value);
  if (clean.length <= maxLength) return clean;
  const slice = clean.slice(0, maxLength - 1);
  const boundary = slice.lastIndexOf(' ');
  return `${slice.slice(0, boundary > 120 ? boundary : slice.length).trim()}…`;
}

function uniquePush(items: string[], value: string) {
  if (!items.includes(value)) items.push(value);
}

function joinNatural(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function articleFor(value: string): string {
  if (value.trim() === 'HMO') return 'an';
  return /^[aeiou]/i.test(value.trim()) ? 'an' : 'a';
}

function normalizePropertyType(value: unknown): string {
  const raw = cleanText(value).toLowerCase();
  if (!raw) return 'property';
  if (/\bdetached\b/.test(raw) && !/house|home|property/.test(raw)) return 'detached house';
  if (/\bsemi[-\s]?detached\b/.test(raw) && !/house|home|property/.test(raw)) return 'semi-detached house';
  if (/\bterraced\b|\bterrace\b/.test(raw) && !/house|home|property/.test(raw)) return 'terraced house';
  if (/\bflat\b|\bapartment\b/.test(raw)) return raw.includes('apartment') ? 'apartment' : 'flat';
  return raw;
}

function normalizeStrategy(value: string): string {
  const clean = cleanText(value);
  const lower = clean.toLowerCase();
  if (!clean || lower === 'cautious review') return 'cautious review';
  if (lower === 'btl' || /buy.?to.?let/.test(lower)) return 'buy-to-let';
  if (lower === 'hmo' || /house in multiple/.test(lower)) return 'HMO';
  if (/flip/.test(lower)) return 'value-add or resale';
  if (/hybrid|brr|brrr|refinance/.test(lower)) return 'hybrid buy-to-let/refinance';
  return clean;
}

function strategyFitPhrase(strategy: string): string {
  if (strategy === 'cautious review') return 'a cautious review before offer';
  if (strategy === 'value-add or resale') return 'a value-add buyer or resale-led investor';
  return `${articleFor(strategy)} ${strategy} investor`;
}

function lowerFirst(value: string): string {
  if (!value) return value;
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function describeAsset(input: InvestmentDescriptionInput): string {
  const type = normalizePropertyType(input.propertyType);
  const beds = typeof input.bedrooms === 'number' && input.bedrooms > 0 ? `${input.bedrooms}-bedroom ` : '';
  const baths =
    typeof input.bathrooms === 'number' && input.bathrooms > 0
      ? ` with ${input.bathrooms} bathroom${input.bathrooms === 1 ? '' : 's'}`
      : '';
  const location = cleanText(input.location);

  if (location) return `This ${beds}${type.toLowerCase()}${baths} in ${location}`;
  return `This ${beds}${type.toLowerCase()}${baths}`;
}

function extractListingSignals(description: string): string[] {
  const lower = description.toLowerCase();
  const signals: string[] = [];

  if (/chain\s*free|no\s+chain/.test(lower)) {
    uniquePush(signals, 'Chain-free');
  }
  if (/station|tube|underground|rail|train|crossrail|elizabeth line/.test(lower)) {
    uniquePush(signals, 'Transport access');
  }
  if (/garden|outdoor|terrace|balcony/.test(lower)) {
    uniquePush(signals, 'Outdoor space');
  }
  if (/extend|extension|stpp|planning|potential/.test(lower)) {
    uniquePush(signals, 'Value-add potential');
  }
  if (/refurb|renovat|modernis|improv|scope/.test(lower)) {
    uniquePush(signals, 'Refurbishment upside');
  }
  if (/tenant|tenanted|let\b|rental/.test(lower)) uniquePush(signals, 'Rental use referenced');
  if (/parking|driveway|garage/.test(lower)) uniquePush(signals, 'Parking or garage');
  if (/school|ofsted/.test(lower)) uniquePush(signals, 'School access');
  if (/auction|cash buyer/.test(lower)) uniquePush(signals, 'Faster diligence needed');
  if (/reduced|below market|bmv|discount/.test(lower)) uniquePush(signals, 'Possible value angle');

  return signals.slice(0, MAX_SIGNALS);
}

function metricSignals(input: InvestmentDescriptionInput): string[] {
  const signals: string[] = [];
  if (typeof input.yieldPercent === 'number') uniquePush(signals, `${formatPercent(input.yieldPercent)} yield`);
  if (typeof input.roiPercent === 'number') {
    uniquePush(signals, `${formatPercent(input.roiPercent)} ${input.roiIsProxy ? 'ROI proxy' : 'ROI'}`);
  }
  if (typeof input.aiScore === 'number') uniquePush(signals, `${Math.round(input.aiScore)}/100 AI score`);
  return signals;
}

function buildChecks(input: InvestmentDescriptionInput, listingSignals: string[]): string[] {
  const checks: string[] = [];

  if (typeof input.yieldPercent !== 'number') uniquePush(checks, 'Verify the achievable rent before underwriting.');
  if (typeof input.roiPercent !== 'number' || input.roiIsProxy) uniquePush(checks, 'Confirm the true ROI after finance, works and fees.');
  if (listingSignals.some((s) => /value-add|refurbishment|condition/.test(s))) {
    uniquePush(checks, 'Price the works and planning risk before offer.');
  }
  uniquePush(checks, 'Check local comparables and resale evidence.');
  uniquePush(checks, 'Stress-test mortgage costs, voids and exit timing.');

  return checks.slice(0, MAX_CHECKS);
}

export function buildInvestmentDescription(input: InvestmentDescriptionInput): InvestmentDescriptionOutput {
  const originalNotes = compactText(input.description, 700);
  const listingSignals = extractListingSignals(originalNotes);
  const metrics = metricSignals(input);
  const checks = buildChecks(input, listingSignals);

  const strategy = normalizeStrategy(cleanText(input.strategyFit) || cleanText(input.investmentType) || 'cautious review');
  const quality = cleanText(input.dealQuality);
  const asset = describeAsset(input);

  const metricParts: string[] = [];
  if (typeof input.price === 'number' && input.price > 0) metricParts.push(`${fmtGBP(input.price)} asking price`);
  if (typeof input.yieldPercent === 'number') metricParts.push(`${formatPercent(input.yieldPercent)} yield`);
  if (typeof input.roiPercent === 'number') {
    metricParts.push(`${formatPercent(input.roiPercent)} ${input.roiIsProxy ? 'ROI proxy' : 'ROI'}`);
  }
  if (typeof input.aiScore === 'number') metricParts.push(`${Math.round(input.aiScore)}/100 AI score`);

  const opening = `${asset} looks best suited to ${strategyFitPhrase(strategy)}.`;
  const qualitySentence = quality ? `Overall, the deal looks ${quality.toLowerCase()} on the information available.` : '';
  const metricsSentence = metricParts.length
    ? `The headline figures are ${joinNatural(metricParts)}.`
    : 'Yield, ROI and score data are limited, so treat this as an early-stage review.';
  const strengthSentence = listingSignals.length
    ? `The listing highlights ${joinNatural(listingSignals
        .slice(0, 3)
        .map((signal) => signal.replace(/\.$/, '').toLowerCase()))}.`
    : 'The listing gives limited investment signals, so the first-pass view should lean on the structured deal metrics.';
  const checksSentence = checks.length
    ? `Before making an offer, ${lowerFirst(checks[0].replace(/\.$/, ''))}.`
    : 'Before making an offer, confirm the rent, costs and comparable values.';

  return {
    paragraph: compactText(`${opening} ${qualitySentence} ${metricsSentence} ${strengthSentence} ${checksSentence}`, 520),
    keySignals: [...metrics, ...listingSignals].slice(0, MAX_SIGNALS),
    checks,
    originalNotes,
  };
}
