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
  hasRentalEvidence?: boolean;
  hasSoldComps?: boolean;
  hasAreaIntel?: boolean;
};

export type InvestorBriefCard = {
  title: 'Best suited for' | 'Opportunity' | 'Check before offer';
  value: string;
  text: string;
};

export type InvestmentDescriptionOutput = {
  paragraph: string;
  keySignals: string[];
  checks: string[];
  originalNotes: string;
  cards: InvestorBriefCard[];
};

const MAX_SIGNALS = 4;
const MAX_CHECKS = 3;
const MAX_NOTES_LENGTH = 700;

type ListingSignal = {
  label: string;
  chip: string;
  phrase: string;
  category: 'chain' | 'outdoor' | 'transport' | 'valueAdd' | 'refurb' | 'parking' | 'school' | 'speed' | 'discount' | 'rental';
};

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

function uniquePush<T>(items: T[], value: T, identity: (item: T) => string = String) {
  const key = identity(value);
  if (!items.some((item) => identity(item) === key)) items.push(value);
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
  if (/\bsemi[-\s]?detached\b/.test(raw) && !/house|home|property/.test(raw)) return 'semi-detached house';
  if (/\bdetached\b/.test(raw) && !/house|home|property/.test(raw)) return 'detached house';
  if (/\bterraced\b|\bterrace\b/.test(raw) && !/house|home|property/.test(raw)) return 'terraced house';
  if (/\bflat\b|\bapartment\b/.test(raw)) return raw.includes('apartment') ? 'apartment' : 'flat';
  return raw;
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

function extractListingSignals(description: string): ListingSignal[] {
  const lower = description.toLowerCase();
  const signals: ListingSignal[] = [];

  if (/chain\s*free|no\s+chain/.test(lower)) {
    uniquePush(signals, { label: 'Chain-free status', chip: 'Chain free', phrase: 'chain-free status', category: 'chain' }, (s) => s.category);
  }
  if (/station|tube|underground|rail|train|crossrail|elizabeth line/.test(lower)) {
    uniquePush(signals, { label: 'Near station', chip: 'Near station', phrase: 'transport access', category: 'transport' }, (s) => s.category);
  }
  if (/large\s+(rear\s+)?garden/.test(lower)) {
    uniquePush(signals, { label: 'Large garden', chip: 'Large garden', phrase: 'a large garden', category: 'outdoor' }, (s) => s.category);
  } else if (/garden|outdoor|terrace|balcony/.test(lower)) {
    uniquePush(signals, { label: 'Outdoor space', chip: 'Outdoor space', phrase: 'outdoor space', category: 'outdoor' }, (s) => s.category);
  }
  if (/extend|extension|stpp|planning|potential/.test(lower)) {
    uniquePush(signals, { label: 'Potential to extend', chip: 'Potential to extend', phrase: 'potential value-add upside', category: 'valueAdd' }, (s) => s.category);
  }
  if (/refurb|renovat|modernis|improv|scope|works required/.test(lower)) {
    uniquePush(signals, { label: 'Needs refurbishment', chip: 'Needs refurbishment', phrase: 'refurbishment upside', category: 'refurb' }, (s) => s.category);
  }
  if (/tenant|tenanted|let\b|rental/.test(lower)) {
    uniquePush(signals, { label: 'Rental use referenced', chip: 'Rental use referenced', phrase: 'rental appeal', category: 'rental' }, (s) => s.category);
  }
  if (/parking|driveway|garage/.test(lower)) {
    uniquePush(signals, { label: 'Parking or garage', chip: 'Parking or garage', phrase: 'parking or garage space', category: 'parking' }, (s) => s.category);
  }
  if (/school|ofsted/.test(lower)) {
    uniquePush(signals, { label: 'School access', chip: 'School access', phrase: 'school access', category: 'school' }, (s) => s.category);
  }
  if (/auction|cash buyer/.test(lower)) {
    uniquePush(signals, { label: 'Faster diligence needed', chip: 'Auction or cash-buyer route', phrase: 'a faster diligence window', category: 'speed' }, (s) => s.category);
  }
  if (/reduced|below market|bmv|discount/.test(lower)) {
    uniquePush(signals, { label: 'Possible value angle', chip: 'Possible value angle', phrase: 'a possible value angle', category: 'discount' }, (s) => s.category);
  }

  return signals;
}

function chooseFit(input: InvestmentDescriptionInput, signals: ListingSignal[]): { value: string; phrase: string; reason: string } {
  const raw = `${cleanText(input.strategyFit)} ${cleanText(input.investmentType)} ${cleanText(input.propertyType)}`.toLowerCase();
  const hasValueAdd = signals.some((signal) => signal.category === 'valueAdd' || signal.category === 'refurb');
  const hasRental = signals.some((signal) => signal.category === 'rental') || /btl|buy.?to.?let|rent|rental|hmo/.test(raw);
  const hasFlip = /flip|resale|auction|bmv|below market/.test(raw);

  if (hasFlip && hasValueAdd) {
    return {
      value: 'Flip',
      phrase: 'a resale-led or flip investor',
      reason: 'The strongest signals point to works, resale or timing-sensitive execution rather than a passive hold.',
    };
  }
  if (hasValueAdd) {
    return {
      value: 'Value-add',
      phrase: 'a value-add investor',
      reason: 'Listing language points to improvement, extension or refurbishment potential that needs costing before offer.',
    };
  }
  if (hasRental || /flat|apartment|terrace|detached|house/.test(raw)) {
    return {
      value: 'BTL',
      phrase: 'a buy-to-let investor',
      reason: 'The asset profile looks more suited to income-led underwriting once achievable rent is verified.',
    };
  }
  return {
    value: 'Hold',
    phrase: 'a cautious hold investor',
    reason: 'Available evidence is limited, so the first step is validating fundamentals before committing to a strategy.',
  };
}

function opportunityFrom(signals: ListingSignal[]): { value: string; text: string; usedCategories: Set<ListingSignal['category']> } {
  const primary = signals.slice(0, 2);
  const usedCategories = new Set(primary.map((signal) => signal.category));
  if (!primary.length) {
    return {
      value: 'Evidence-light listing',
      text: 'The source notes provide limited positive signals, so the brief should stay cautious until market evidence is checked.',
      usedCategories,
    };
  }

  return {
    value: primary.map((signal) => signal.label).join(' + '),
    text: `Useful listing signals include ${joinNatural(primary.map((signal) => signal.phrase))}.`,
    usedCategories,
  };
}

function buildChecks(input: InvestmentDescriptionInput, listingSignals: ListingSignal[]): string[] {
  const checks: string[] = [];
  const hasWorksOrPlanning = listingSignals.some((signal) => signal.category === 'valueAdd' || signal.category === 'refurb');
  const hasExplicitRentalEvidence = input.hasRentalEvidence === true;
  const hasComps = input.hasSoldComps === true;

  if (!hasExplicitRentalEvidence) {
    uniquePush(checks, 'Validate achievable rent against nearby rental evidence.');
  }
  if (hasComps) {
    uniquePush(checks, 'Compare recent Land Registry sold comps before offer.');
  }
  if (hasWorksOrPlanning) {
    uniquePush(checks, 'Confirm refurbishment, planning, finance and void-cost assumptions.');
  }
  if (!hasWorksOrPlanning) {
    uniquePush(checks, 'Confirm refurbishment, finance, legal and void-cost assumptions.');
  }

  return checks.slice(0, MAX_CHECKS);
}

function checkCardValue(checks: string[]): string {
  if (checks.some((check) => /rent/i.test(check))) return 'Validate rent and costs';
  if (checks.some((check) => /Land Registry|sold comps/i.test(check))) return 'Check sold comps';
  if (checks.some((check) => /planning|refurbishment/i.test(check))) return 'Price works risk';
  return 'Validate assumptions';
}

export function buildInvestmentDescription(input: InvestmentDescriptionInput): InvestmentDescriptionOutput {
  const originalNotes = compactText(input.description, MAX_NOTES_LENGTH);
  const listingSignals = extractListingSignals(originalNotes);
  const fit = chooseFit(input, listingSignals);
  const opportunity = opportunityFrom(listingSignals);
  const checks = buildChecks(input, listingSignals);
  const quality = cleanText(input.dealQuality).toLowerCase();
  const asset = describeAsset(input);

  const qualityPhrase = quality && !/unknown|n\/a/.test(quality) ? ` Overall, the available evidence looks ${quality}, but it still needs market validation.` : '';
  const signalPhrase = listingSignals.length
    ? ` The available listing evidence points to ${joinNatural(listingSignals.slice(0, 3).map((signal) => signal.phrase))}.`
    : ' The available listing evidence is limited, so investors should avoid assuming upside that is not supported by the source notes.';
  const checkPhrase = checks.length
    ? ` Before making an offer, investors should ${checks[0].replace(/\.$/, '').toLowerCase()}.`
    : ' Before progressing, investors should validate the core underwriting assumptions.';

  const chips = listingSignals
    .filter((signal) => !opportunity.usedCategories.has(signal.category))
    .map((signal) => signal.chip)
    .slice(0, MAX_SIGNALS);

  return {
    paragraph: compactText(`${asset} appears best suited to ${fit.phrase}.${qualityPhrase}${signalPhrase}${checkPhrase}`, 430),
    keySignals: chips,
    checks,
    originalNotes,
    cards: [
      {
        title: 'Best suited for',
        value: fit.value,
        text: fit.reason,
      },
      {
        title: 'Opportunity',
        value: opportunity.value,
        text: opportunity.text,
      },
      {
        title: 'Check before offer',
        value: checkCardValue(checks),
        text: checks[0] ?? 'Validate the main underwriting assumptions before progressing.',
      },
    ],
  };
}

export const buildInvestorBrief = buildInvestmentDescription;
