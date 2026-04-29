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

function describeAsset(input: InvestmentDescriptionInput): string {
  const type = cleanText(input.propertyType) || 'property';
  const beds = typeof input.bedrooms === 'number' && input.bedrooms > 0 ? `${input.bedrooms}-bed ` : '';
  const baths =
    typeof input.bathrooms === 'number' && input.bathrooms > 0
      ? ` with ${input.bathrooms} bath${input.bathrooms === 1 ? '' : 's'}`
      : '';
  const location = cleanText(input.location);

  if (location) return `This ${beds}${type.toLowerCase()}${baths} in ${location}`;
  return `This ${beds}${type.toLowerCase()}${baths}`;
}

function extractListingSignals(description: string): string[] {
  const lower = description.toLowerCase();
  const signals: string[] = [];

  if (/chain\s*free|no\s+chain/.test(lower)) {
    uniquePush(signals, 'Chain-free status may reduce transaction friction.');
  }
  if (/station|tube|underground|rail|train|crossrail|elizabeth line/.test(lower)) {
    uniquePush(signals, 'Transport access is mentioned in the listing.');
  }
  if (/garden|outdoor|terrace|balcony/.test(lower)) {
    uniquePush(signals, 'Outdoor space is a visible tenant/resale signal.');
  }
  if (/extend|extension|stpp|planning|potential/.test(lower)) {
    uniquePush(signals, 'There may be value-add potential subject to checks.');
  }
  if (/refurb|renovat|modernis|improv|scope/.test(lower)) {
    uniquePush(signals, 'Condition or refurbishment upside should be assessed.');
  }
  if (/tenant|tenanted|let\b|rental/.test(lower)) uniquePush(signals, 'Rental use is referenced in the source listing.');
  if (/parking|driveway|garage/.test(lower)) uniquePush(signals, 'Parking or garage provision is mentioned.');
  if (/school|ofsted/.test(lower)) uniquePush(signals, 'School access is mentioned in the listing.');
  if (/auction|cash buyer/.test(lower)) uniquePush(signals, 'Purchase route may require faster diligence or specialist funding.');
  if (/reduced|below market|bmv|discount/.test(lower)) uniquePush(signals, 'Pricing language suggests a possible value angle.');

  return signals.slice(0, MAX_SIGNALS);
}

function metricSignals(input: InvestmentDescriptionInput): string[] {
  const signals: string[] = [];
  if (typeof input.yieldPercent === 'number') uniquePush(signals, `${formatPercent(input.yieldPercent)} yield.`);
  if (typeof input.roiPercent === 'number') {
    uniquePush(signals, `${formatPercent(input.roiPercent)} ${input.roiIsProxy ? 'ROI proxy' : 'ROI'}.`);
  }
  if (typeof input.aiScore === 'number') uniquePush(signals, `${Math.round(input.aiScore)}/100 AI deal score.`);
  return signals;
}

function buildChecks(input: InvestmentDescriptionInput, listingSignals: string[]): string[] {
  const checks: string[] = [];

  if (typeof input.yieldPercent !== 'number') uniquePush(checks, 'Verify achievable rent before underwriting.');
  if (typeof input.roiPercent !== 'number' || input.roiIsProxy) uniquePush(checks, 'Confirm true ROI after finance, works and fees.');
  if (listingSignals.some((s) => /value-add|refurbishment|condition/.test(s))) {
    uniquePush(checks, 'Price refurbishment and planning risk before offer.');
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

  const strategy = cleanText(input.strategyFit) || cleanText(input.investmentType) || 'cautious review';
  const quality = cleanText(input.dealQuality);
  const asset = describeAsset(input);

  const metricParts: string[] = [];
  if (typeof input.price === 'number' && input.price > 0) metricParts.push(`${fmtGBP(input.price)} asking price`);
  if (typeof input.yieldPercent === 'number') metricParts.push(`${formatPercent(input.yieldPercent)} yield`);
  if (typeof input.roiPercent === 'number') {
    metricParts.push(`${formatPercent(input.roiPercent)} ${input.roiIsProxy ? 'ROI proxy' : 'ROI'}`);
  }
  if (typeof input.aiScore === 'number') metricParts.push(`${Math.round(input.aiScore)}/100 AI score`);

  const opening = `${asset} appears best suited to a ${strategy} investor${
    quality ? `, with a ${quality.toLowerCase()} deal read` : ''
  }.`;
  const metricsSentence = metricParts.length
    ? `The headline numbers show ${metricParts.join(' · ')}.`
    : 'Headline yield, ROI and score data are limited, so the case should be treated as early-stage.';
  const strengthSentence = listingSignals.length
    ? `Key source-listing signals include ${listingSignals
        .slice(0, 3)
        .map((signal) => signal.replace(/\.$/, '').toLowerCase())
        .join(', ')}.`
    : 'The source listing gives limited investment signals, so the structured facts should drive the first-pass review.';
  const checksSentence = checks.length
    ? `Before committing, ${checks[0].replace(/\.$/, '').toLowerCase()}.`
    : 'Before committing, confirm the rent, costs and comparable values.';

  return {
    paragraph: compactText(`${opening} ${metricsSentence} ${strengthSentence} ${checksSentence}`, 520),
    keySignals: [...metrics, ...listingSignals].slice(0, MAX_SIGNALS),
    checks,
    originalNotes,
  };
}
