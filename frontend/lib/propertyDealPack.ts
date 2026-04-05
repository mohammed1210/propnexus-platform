import { getRoiDisplay, getYieldPercent } from '@/lib/normalizeProperty';

export type ExportMetric = {
  label: string;
  value: string;
  isPlaceholder?: boolean;
  isDerived?: boolean;
};

/** A financial line item. `isPlaceholder` flags rows where data is not yet available. */
export type FinancialLineItem = {
  label: string;
  value: string;
  isPlaceholder?: boolean;
  tier?: 'core' | 'extended';
};

export type PropertyPdfExportInput = {
  propertyId: string;
  property?: Record<string, unknown> | null;
  url?: string;
  price?: number;
  yieldPercent?: number;
  roiPercent?: number;
  discountPercent?: number;
  aiScore?: number;
};

export type PropertyPdfSections = {
  brandTitle: string;
  reportTitle: string;
  reportSubtitle: string;
  title: string;
  location: string;
  titleMeta: ExportMetric[];
  metrics: ExportMetric[];
  highlights: string[];
  investmentInsight: string;
  overview: ExportMetric[];
  notes: string;
  hasNarrativeDescription: boolean;
  exportedAt: string;
  sourceUrl: string;
  imageUrl?: string;
};

export type DealPackSection = {
  title: string;
  body: string[];
};

export type PropertyDealPackModel = {
  filename: string;
  headline: string;
  location: string;
  propertyType: string;
  investmentType: string;
  marketStatus: 'on-market' | 'off-market' | null;
  brandTitle: string;
  reportTitle: string;
  reportSubtitle: string;
  metadataChips: ExportMetric[];
  snapshotCards: ExportMetric[];
  highlights: string[];
  investmentInsight: string;
  /** Section D — Property Details */
  propertyDetails: ExportMetric[];
  /** Section E — Area & Demand */
  areaDemand: ExportMetric[];
  /** Section F — Financial Breakdown */
  financialBreakdown: FinancialLineItem[];
  financialSnapshot: FinancialLineItem[];
  financialDetails: FinancialLineItem[];
  executiveSummary: string[];
  executiveSummaryPreview: string[];
  /** Section H — Summary / Underwriting Note */
  summaryNote: string[];
  summarySnapshot: ExportMetric[];
  supportingSections: DealPackSection[];
  exportedAt: string;
  sourceUrl: string;
  sourceUrlDisplay: string;
  imageUrl?: string;
  hasImage: boolean;
  hasNarrativeDescription: boolean;
  packMode: 'lean' | 'full';
  requiresSecondPage: boolean;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toCurrencyNumber = (value: unknown): number | undefined => {
  const direct = toNumber(value);
  if (typeof direct === 'number') return direct;
  if (typeof value !== 'string') return undefined;

  const normalized = value
    .trim()
    .replace(/,/g, '')
    .replace(/[\u00A0\s]+/g, ' ')
    .toLowerCase();

  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const resolveRentMonthly = (property: Record<string, unknown>): number | undefined => {
  const rentCandidates: unknown[] = [
    property.monthly_rent,
    property.rent_monthly,
    property.monthlyRent,
    property.rent_pcm,
    property.rent_per_month,
    property.rentPerMonth,
    property.rent,
  ];

  for (const candidate of rentCandidates) {
    const parsed = toCurrencyNumber(candidate);
    if (typeof parsed === 'number') return parsed;
  }

  return undefined;
};

const formatCurrency = (value: number | undefined): string => {
  if (typeof value !== 'number') return 'N/A';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number | undefined): string => {
  if (typeof value !== 'number') return 'N/A';
  return `${value.toFixed(1)}%`;
};

const formatDate = (): string => {
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
};

const sanitizeFilenamePart = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
};

const getText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const IMAGE_DIRECT_FIELDS = ['imageUrl', 'image_url', 'imageurl', 'thumbnail', 'cover_photo_url'] as const;
const IMAGE_COLLECTION_FIELDS = ['image_urls', 'imageUrls', 'images', 'photos'] as const;
const IMAGE_OBJECT_KEYS = ['url', 'src', 'imageUrl', 'image_url'] as const;
// Keep insight copy concise so page one remains visually balanced in the template route and PDF output.
const MAX_INSIGHT_LENGTH = 420;
const HIGHLIGHT_LIMIT = 6;
const HIGHLIGHT_SIGNAL_RULES = [
  { pattern: /\b(chain free|no onward chain|vacant possession)\b/i, score: 7 },
  { pattern: /\b(detached|semi[- ]detached|terraced?|bungalow|maisonette|flat|apartment|house)\b/i, score: 3 },
  { pattern: /\b\d+\s*(?:bed|bedroom)s?\b|\bbed(?:room)?s?\b/i, score: 5 },
  { pattern: /\b\d+\s*(?:bath|bathroom)s?\b|\bbath(?:room)?s?\b/i, score: 4 },
  { pattern: /\b(driveway|garage|parking|garden|reception room|loft|annexe|extension)\b/i, score: 4 },
  { pattern: /\b(refurb(?:ishment)?|renovat(?:e|ion)|moderni[sz]ed|project|development|planning|upside|hmo|brrr|btl|buy to let|flip)\b/i, score: 5 },
  { pattern: /\b(station|transport|rail|commuter|school|catchment|city centre|town centre|high street|amenities)\b/i, score: 4 },
  { pattern: /\b(freehold|leasehold|tenanted|tenant demand|rental demand|yield|income)\b/i, score: 4 },
] as const;
const HIGHLIGHT_REJECT_PATTERNS = [
  /\bmust be viewed\b/i,
  /\bviewing (?:is )?highly recommended\b/i,
  /\bearly viewing advised\b/i,
  /\bcontact .* today\b/i,
  /^\b(call|contact)\b/i,
] as const;
const TRAILING_CONNECTOR_PATTERN = /\b(?:a|an|and|for|from|in|into|near|of|on|the|to|with)$/i;

const getImageCandidateUrl = (value: unknown): string | undefined => {
  const direct = getText(value);
  if (direct) return direct;
  if (!value || typeof value !== 'object') return undefined;

  for (const key of IMAGE_OBJECT_KEYS) {
    const url = getText((value as Record<string, unknown>)[key]);
    if (url) return url;
  }

  return undefined;
};

const parseImageCollection = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  const text = getText(value);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const resolvePrimaryImageUrl = (property: Record<string, unknown>): string | undefined => {
  for (const field of IMAGE_DIRECT_FIELDS) {
    const url = getImageCandidateUrl(property[field]);
    if (url) return url;
  }

  for (const field of IMAGE_COLLECTION_FIELDS) {
    for (const candidate of parseImageCollection(property[field])) {
      const url = getImageCandidateUrl(candidate);
      if (url) return url;
    }
  }

  return undefined;
};

const createEmptyNotesState = (property: Record<string, unknown>): string => {
  const title = getText(property.title) ?? 'This property';
  return `${title} does not include a narrative description in the live listing. This export still captures the core pricing, location, and screening data, but condition and layout should be checked against the source details before progressing.`;
};

const normalizeNarrativeText = (value: string): string => {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
};

const sentenceCase = (value: string): string => {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const cleanPropertyType = (propertyType: string): string => {
  return /unavailable/i.test(propertyType) ? 'Residential asset' : propertyType;
};

const cleanInvestmentType = (investmentType: string): string => {
  return /unavailable/i.test(investmentType) ? 'investment' : investmentType;
};

const withIndefiniteArticle = (value: string): string => {
  if (!value) return value;
  return /^[aeiou]/i.test(value) ? `an ${value}` : `a ${value}`;
};

const formatBedroomBathroomValue = (bedrooms?: number, bathrooms?: number): string => {
  if (typeof bedrooms === 'number' && typeof bathrooms === 'number') return `${bedrooms} bed / ${bathrooms} bath`;
  if (typeof bedrooms === 'number') return `${bedrooms} bed`;
  if (typeof bathrooms === 'number') return `${bathrooms} bath`;
  return 'Not specified';
};

const cleanListingLanguage = (value: string): string => {
  return value
    .replace(/\bjust a stone'?s throw(?: away)? from\b/gi, 'close to')
    .replace(/\bwithin easy reach of\b/gi, 'close to')
    .replace(/\bideally located for\b/gi, 'well located for')
    .replace(/\bperfectly positioned for\b/gi, 'well placed for')
    .replace(/\bboasting\b/gi, 'with')
    .replace(/\bbenefitting from\b/gi, 'with')
    .replace(/\bbenefiting from\b/gi, 'with')
    .replace(/\boffering\b/gi, 'with')
    .replace(/\b(?:welcome to|introducing|presenting)\s+(?:this|a|an)?\s*/gi, '')
    .replace(/\b(?:stunning|beautiful|immaculate|fantastic|wonderful|superb|exceptional|delightful|lovely|attractive|charming)\b/gi, '')
    .replace(/\b(?:must be viewed|viewing is highly recommended|internal viewing is highly recommended|early viewing advised)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const cleanNarrativeSegment = (value: string): string => {
  const cleaned = cleanListingLanguage(value)
    .replace(/^[\s•*\-,:;]+/, '')
    .replace(/^(?:this|the)\s+(?:property|home)\s+/i, '')
    .replace(/^(?:and|with|plus|including)\s+/i, '')
    .replace(/[\s,;:]+$/g, '')
    .replace(/\s+[/-]\s+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return sentenceCase(cleaned);
};

const expandNarrativeSegment = (segment: string): string[] => {
  const closeToSplit = segment.match(/^(.*?\b(?:detached|semi-detached|terraced?|bungalow|maisonette|flat|apartment|house)\b)\s+close to\s+(.+)$/i);
  if (!closeToSplit) return [segment];

  const [, propertySignal, locationSignal] = closeToSplit;
  return [sentenceCase(propertySignal.trim()), sentenceCase(`close to ${locationSignal.trim()}`)];
};

const trimTextLength = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  const slice = value.slice(0, maxLength - 1);
  let trimmed = slice.slice(0, Math.max(0, slice.lastIndexOf(' '))).trim();
  while (TRAILING_CONNECTOR_PATTERN.test(trimmed)) {
    trimmed = trimmed.replace(/\s+\S+$/, '').trim();
  }
  return `${trimmed || slice.trim()}…`;
};

const PLACEHOLDER_VALUE_PATTERN = /^(?:awaiting source data|not supplied|not specified|n\/a|pending|not scored)$/i;

const hasMeaningfulMetricValue = (value: string | undefined): boolean => {
  const text = getText(value);
  return Boolean(text && !PLACEHOLDER_VALUE_PATTERN.test(text));
};

const countMeaningfulMetrics = <T extends { value: string; isPlaceholder?: boolean }>(items: T[]): number => {
  return items.filter((item) => !item.isPlaceholder && hasMeaningfulMetricValue(item.value)).length;
};

const createFallbackHighlights = (
  location: string,
  propertyType: string,
  investmentType: string,
  bedrooms?: number,
  bathrooms?: number,
): string[] => {
  const resolvedPropertyType = cleanPropertyType(propertyType);
  const resolvedInvestmentType = cleanInvestmentType(investmentType);
  const highlights = [`${resolvedPropertyType} opportunity in ${location}`];

  if (typeof bedrooms === 'number' || typeof bathrooms === 'number') {
    highlights.push(`Configured as ${formatBedroomBathroomValue(bedrooms, bathrooms).toLowerCase()}`);
  }

  highlights.push(`Aligned to ${withIndefiniteArticle(resolvedInvestmentType)} strategy`);
  highlights.push('Review the live listing to confirm finish, layout, and execution detail');

  return highlights.slice(0, 4);
};

const splitNarrativeCandidates = (description: string): string[] => {
  return normalizeNarrativeText(description)
    .split(/(?:\n+|[•*]+|;\s+|(?<=[.!?])\s+)/)
    .flatMap((segment) => segment.split(/\s*[—–]\s*/))
    .flatMap((segment) => segment.split(/,\s+/))
    .flatMap((segment) => segment.split(/\s+\band\b\s+/i));
};

const scoreHighlightCandidate = (segment: string): number => {
  if (segment.length > 120) return -1;
  if (HIGHLIGHT_REJECT_PATTERNS.some((pattern) => pattern.test(segment))) return -1;

  let score = 0;
  for (const rule of HIGHLIGHT_SIGNAL_RULES) {
    if (rule.pattern.test(segment)) score += rule.score;
  }

  if (/^[A-Z0-9][^.]{0,100}$/.test(segment)) score += 1;
  if (segment.length >= 35 && segment.length <= 90) score += 1;
  if (/\b(detached|semi[- ]detached|terraced?|bungalow|maisonette|flat|apartment|house)\b/i.test(segment)) score += 2;
  if (/\b(close to|well located for|chain free|newly refurbished|refurbishment upside)\b/i.test(segment)) score += 2;
  if (segment.length < 24 && score < 4) return -1;
  if (segment.length < 14 && score < 6) return -1;

  return score;
};

const extractDealHighlights = (description: string | undefined, fallbackHighlights: string[]): string[] => {
  if (!description) return fallbackHighlights;

  const seen = new Set<string>();
  const highlights = splitNarrativeCandidates(description)
    .map(cleanNarrativeSegment)
    .flatMap(expandNarrativeSegment)
    .map((segment) => trimTextLength(segment, 100))
    .filter((segment) => {
      const key = segment.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((segment) => ({ segment, score: scoreHighlightCandidate(segment) }))
    .filter(({ score }) => score >= 2)
    .sort((left, right) => right.score - left.score || left.segment.length - right.segment.length)
    .map(({ segment }) => segment)
    .slice(0, HIGHLIGHT_LIMIT);

  return highlights.length ? highlights : fallbackHighlights;
};

const createExecutiveSummary = (
  description: string | undefined,
  fallbackText: string,
  location: string,
  propertyType: string,
  investmentType: string,
  bedrooms: number | undefined,
  bathrooms: number | undefined,
  highlights: string[],
): string => {
  const resolvedPropertyType = cleanPropertyType(propertyType);
  const resolvedInvestmentType = cleanInvestmentType(investmentType);
  const accommodation = formatBedroomBathroomValue(bedrooms, bathrooms).toLowerCase();
  const introParts = [`This ${resolvedInvestmentType} opportunity focuses on a ${resolvedPropertyType.toLowerCase()}`];
  if (accommodation !== 'not specified') introParts.push(`with a ${accommodation} layout`);
  introParts.push(`in ${location}.`);
  const intro = introParts.join(' ').replace(/\s+\./, '.');

  if (!description) {
    return trimTextLength(
      `${intro} Narrative detail is limited in the live listing, so finish, configuration, and condition should be confirmed directly from the source before underwriting.`,
      360,
    );
  }

  const sentences = splitNarrativeCandidates(description)
    .map(cleanNarrativeSegment)
    .flatMap(expandNarrativeSegment)
    .map((segment) => trimTextLength(segment, 120))
    .filter(Boolean)
    .filter((segment) => scoreHighlightCandidate(segment) >= 2);

  const highlightKeys = new Set(highlights.map((highlight) => highlight.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()));
  const supportingPoints = sentences.filter((segment) => {
    const key = segment.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return key && !highlightKeys.has(key);
  });

  const summaryParts = [intro];
  if (supportingPoints.length) {
    summaryParts.push(`${supportingPoints.slice(0, 3).join('. ')}.`);
  } else if (highlights.length) {
    summaryParts.push(`Key listing signals include ${highlights.slice(0, 2).map((item) => item.toLowerCase()).join(' and ')}.`);
  } else {
    summaryParts.push(fallbackText);
  }

  return trimTextLength(summaryParts.join(' ').replace(/\.\s*\./g, '.'), 520);
};

const classifyYield = (value: number | undefined): string | undefined => {
  if (typeof value !== 'number') return undefined;
  if (value >= 7) return 'solid';
  if (value >= 5.5) return 'steady';
  if (value >= 4.5) return 'modest';
  return 'weak';
};

const classifyRoi = (value: number | undefined): string | undefined => {
  if (typeof value !== 'number') return undefined;
  if (value >= 15) return 'strong';
  if (value >= 10) return 'attractive';
  if (value >= 7) return 'reasonable';
  return 'limited';
};

const classifyDiscount = (value: number | undefined): string | undefined => {
  if (typeof value !== 'number') return undefined;
  if (value >= 15) return 'notable';
  if (value >= 8) return 'meaningful';
  if (value > 0) return 'slight';
  return undefined;
};

const detectDemandSignal = (highlights: string[], description: string | undefined): string | undefined => {
  const text = `${highlights.join(' ')} ${description ?? ''}`.toLowerCase();
  if (!text.trim()) return undefined;
  if (/(refurb|renovat|moderni[sz]|upgrade)/.test(text)) return 'refurbishment upside';
  if (/(station|transport|commuter|rail|link)/.test(text)) return 'commuter connectivity';
  if (/(tenant demand|rental demand|yield|income)/.test(text)) return 'income-led demand';
  if (/(family|school|garden|house)/.test(text)) return 'practical family appeal';
  if (/(city centre|central|amenit|high street)/.test(text)) return 'everyday amenity access';
  return undefined;
};

const describeOpportunity = (
  investmentType: string,
  propertyType: string,
  bedrooms?: number,
): { opportunity: string; strategy: string } => {
  const investmentKey = investmentType.toLowerCase();
  const propertyKey = propertyType.toLowerCase();
  const familyAppeal =
    typeof bedrooms === 'number' && bedrooms >= 3 && propertyKey.includes('house')
      ? ' with family-house appeal'
      : typeof bedrooms === 'number' && bedrooms <= 2
        ? ' with practical rental appeal'
        : '';

  if (/(brrr|refurb|value add|development)/.test(investmentKey)) {
    return { opportunity: `value-add ${investmentType} opportunity${familyAppeal}`, strategy: 'a hold-and-refinance angle' };
  }
  if (/(flip|resale|sell)/.test(investmentKey)) {
    return { opportunity: `refurb-and-exit opportunity${familyAppeal}`, strategy: 'a refurb-and-sell path' };
  }
  if (/(hmo|multi-let)/.test(investmentKey)) {
    return { opportunity: `shared-accommodation income opportunity${familyAppeal}`, strategy: 'an income-focused operating plan' };
  }
  if (/(buy to let|rental|hold|let)/.test(investmentKey)) {
    return { opportunity: `income-oriented ${investmentType} opportunity${familyAppeal}`, strategy: 'a hold-for-income profile' };
  }
  return { opportunity: `${investmentType} opportunity${familyAppeal}`, strategy: 'cautious review until the exit path is verified' };
};

export const createInvestmentInsight = (input: PropertyPdfExportInput): string => {
  const property = input.property ?? {};
  const location = getText(property.location) ?? 'the stated location';
  const propertyType = cleanPropertyType(getText(property.propertyType ?? property.property_type) ?? 'property');
  const investmentType = cleanInvestmentType(getText(property.investmentType ?? property.investment_type) ?? 'investment');
  const bedrooms = toNumber(property.bedrooms);
  const description = getText(property.description);
  const highlights = extractDealHighlights(
    description,
    createFallbackHighlights(location, propertyType, investmentType, bedrooms, toNumber(property.bathrooms)),
  );
  const mergedMetricsSource: Record<string, unknown> = { ...property };
  if (typeof input.price === 'number') mergedMetricsSource.price = input.price;
  if (typeof input.yieldPercent === 'number') mergedMetricsSource.yield_percent = input.yieldPercent;
  if (typeof input.roiPercent === 'number') mergedMetricsSource.roi_percent = input.roiPercent;

  const yieldPercent = getYieldPercent(mergedMetricsSource) ?? undefined;
  const roiPercent = getRoiDisplay(mergedMetricsSource).value ?? undefined;
  const discountPercent =
    typeof input.discountPercent === 'number'
      ? input.discountPercent
      : toNumber(property.discount_percent ?? property.discount_estimate_pct);

  const { opportunity, strategy } = describeOpportunity(investmentType, propertyType, bedrooms);
  const demandSignal = detectDemandSignal(highlights, description);
  const yieldTone = classifyYield(yieldPercent);
  const roiTone = classifyRoi(roiPercent);
  const discountTone = classifyDiscount(discountPercent);

  const insightSentences = [`This screens as a ${opportunity} in ${location}.`];
  const metricClauses: string[] = [];
  if (yieldTone && typeof yieldPercent === 'number') metricClauses.push(`yield is ${yieldTone} at ${yieldPercent.toFixed(1)}%`);
  if (roiTone && typeof roiPercent === 'number') metricClauses.push(`ROI looks ${roiTone} at ${roiPercent.toFixed(1)}%`);
  if (metricClauses.length) {
    insightSentences.push(`Current returns suggest ${metricClauses.join(' while ')}, which points to ${strategy}.`);
  } else if (typeof discountPercent === 'number' && discountTone) {
    insightSentences.push(`Pricing currently indicates a ${discountTone} ${discountPercent.toFixed(1)}% discount, but income assumptions still need to be validated against the live listing.`);
  } else {
    insightSentences.push('Headline return data is incomplete, so pricing, rent, and exit assumptions should be validated before moving beyond initial screening.');
  }

  insightSentences.push(
    demandSignal
      ? `Listing detail also points to ${demandSignal}, which may support the case once source diligence is complete.`
      : 'Source-level diligence is still needed to confirm condition, timing, and execution risk.',
  );

  return trimTextLength(insightSentences.join(' '), MAX_INSIGHT_LENGTH);
};

const stripUrlProtocol = (value: string): string => value.replace(/^https?:\/\//i, '').replace(/^www\./i, '');

const truncateMiddle = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  const keepStart = Math.max(12, Math.ceil((maxLength - 1) * 0.68));
  const keepEnd = Math.max(8, maxLength - keepStart - 1);
  return `${value.slice(0, keepStart).replace(/[/?#=&-]+$/g, '')}…${value.slice(-keepEnd)}`;
};

export const formatSourceUrlDisplay = (value: string, maxLength = 76): string => {
  if (value === 'Source URL unavailable') return value;

  try {
    const url = new URL(value);
    const normalized = `${url.hostname.replace(/^www\./i, '')}${url.pathname}${url.search}`.replace(/\/$/, '');
    return truncateMiddle(normalized || stripUrlProtocol(value), maxLength);
  } catch {
    return truncateMiddle(stripUrlProtocol(value), maxLength);
  }
};

// ─── New field resolvers ────────────────────────────────────────────────────

const PENDING = 'Awaiting source data';

const resolveFirstText = (property: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = getText(property[key]);
    if (value) return value;
  }
  return undefined;
};

const resolveFirstNumber = (property: Record<string, unknown>, ...keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = toNumber(property[key]);
    if (typeof value === 'number') return value;
  }
  return undefined;
};

const resolveMarketStatus = (property: Record<string, unknown>): 'on-market' | 'off-market' | null => {
  const statusText = resolveFirstText(property, 'market_status', 'marketStatus', 'listing_status', 'listingStatus');
  if (statusText) {
    if (/off[- ]?market/i.test(statusText)) return 'off-market';
    if (/on[- ]?market|active|listed/i.test(statusText)) return 'on-market';
  }
  const offMarketBool = property.off_market ?? property.offMarket;
  if (offMarketBool === true || offMarketBool === 'true') return 'off-market';
  if (offMarketBool === false || offMarketBool === 'false') return 'on-market';
  return null;
};

const resolveSquareFootage = (property: Record<string, unknown>): string | undefined => {
  const sqft = resolveFirstNumber(property, 'square_footage', 'squareFootage', 'floor_area', 'floorArea', 'size_sqft', 'area_sqft');
  if (typeof sqft === 'number') return `${sqft.toLocaleString('en-GB')} sq ft`;
  const sqm = resolveFirstNumber(property, 'square_metres', 'squareMetres', 'area_sqm', 'floor_area_sqm');
  if (typeof sqm === 'number') return `${sqm.toLocaleString('en-GB')} m²`;
  return undefined;
};

const resolveFloorPlan = (property: Record<string, unknown>): string | undefined => {
  const fp = property.floor_plan ?? property.floorPlan ?? property.has_floor_plan ?? property.hasFloorPlan;
  if (fp === true || fp === 'true' || fp === 'yes') return 'Available';
  if (fp === false || fp === 'false' || fp === 'no') return 'Not available';
  const fpUrl = resolveFirstText(property, 'floor_plan_url', 'floorPlanUrl', 'floor_plan');
  if (fpUrl && /^https?:\/\//i.test(fpUrl)) return 'Available';
  return undefined;
};

const resolveAmenities = (property: Record<string, unknown>): string | undefined => {
  const value = property.amenities;
  if (Array.isArray(value) && value.length > 0) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .join(', ');
  }
  const text = resolveFirstText(property, 'amenities', 'nearby_amenities', 'nearbyAmenities');
  return text ?? undefined;
};

const resolveTransport = (property: Record<string, unknown>): string | undefined => {
  const value = property.transport_links ?? property.transportLinks ?? property.transport;
  if (Array.isArray(value) && value.length > 0) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .join(', ');
  }
  const text = resolveFirstText(property, 'transport_links', 'transportLinks', 'transport', 'nearby_transport');
  return text ?? undefined;
};

const resolveAreaDemandField = (property: Record<string, unknown>, ...keys: string[]): string | undefined => {
  const text = resolveFirstText(property, ...keys);
  return text || undefined;
};

// ─── Section builders ───────────────────────────────────────────────────────

const buildPropertyDetailsSection = (
  property: Record<string, unknown>,
): ExportMetric[] => {
  const marketStatus = resolveMarketStatus(property);
  const squareFootage = resolveSquareFootage(property);
  const floorPlan = resolveFloorPlan(property);
  const amenities = resolveAmenities(property);
  const transport = resolveTransport(property);
  const marketStatusLabel = marketStatus === 'off-market' ? 'Off-Market' : marketStatus === 'on-market' ? 'On-Market' : undefined;
  return [
    { label: 'Square Footage', value: squareFootage ?? '', isPlaceholder: !squareFootage },
    { label: 'Floor Plan', value: floorPlan ?? '', isPlaceholder: !floorPlan },
    { label: 'Amenities', value: amenities ?? '', isPlaceholder: !amenities },
    { label: 'Transport Links', value: transport ?? '', isPlaceholder: !transport },
    { label: 'Market Status', value: marketStatusLabel ?? '', isPlaceholder: !marketStatusLabel },
  ].filter((item) => hasMeaningfulMetricValue(item.value));
};

const buildAreaDemandSection = (property: Record<string, unknown>, rentMonthly: number | undefined): ExportMetric[] => {
  const expectedRent = resolveAreaDemandField(property, 'expected_rent', 'expectedRent', 'avg_area_rent', 'area_avg_rent');
  const tenantType = resolveAreaDemandField(property, 'tenant_type', 'tenantType', 'likely_tenant', 'likelyTenant', 'demand_profile', 'demandProfile');
  const areaDemand = resolveAreaDemandField(property, 'area_demand', 'areaDemand', 'demand_notes', 'demandNotes');
  const growthContext = resolveAreaDemandField(property, 'growth_context', 'growthContext', 'price_growth', 'priceGrowth', 'capital_growth');
  const crimeNotes = resolveAreaDemandField(property, 'crime_notes', 'crimeNotes', 'crime_rate', 'crimeRate');
  const demographicNotes = resolveAreaDemandField(property, 'demographic_notes', 'demographicNotes', 'demographics', 'area_notes', 'areaNotes');

  const items: ExportMetric[] = [
    expectedRent
      ? { label: 'Expected Rent', value: expectedRent }
      : typeof rentMonthly === 'number'
        ? { label: 'Expected Rent', value: `~${formatCurrency(rentMonthly)} PCM (from listing)`, isDerived: true }
        : { label: 'Expected Rent', value: PENDING, isPlaceholder: true },
    { label: 'Likely Tenant Type', value: tenantType ?? PENDING, isPlaceholder: !tenantType },
    { label: 'Area Demand', value: areaDemand ?? PENDING, isPlaceholder: !areaDemand },
    { label: 'Growth / Price Context', value: growthContext ?? PENDING, isPlaceholder: !growthContext },
    { label: 'Crime / Safety Notes', value: crimeNotes ?? PENDING, isPlaceholder: !crimeNotes },
    { label: 'Demographic / Area Notes', value: demographicNotes ?? PENDING, isPlaceholder: !demographicNotes },
  ];

  return items.filter((item) => !item.isPlaceholder);
};

const resolveStampDuty = (property: Record<string, unknown>, price: number | undefined): string => {
  const explicit = resolveFirstNumber(property, 'stamp_duty', 'stampDuty', 'sdlt', 'stamp_duty_amount');
  if (typeof explicit === 'number') return formatCurrency(explicit);
  // Estimated England/Wales SDLT for additional residential property (Finance Act 2024 rates).
  // Thresholds and rates in ascending order: [upper limit, marginal rate]
  // The 3% additional-dwelling surcharge is baked into each rate band below.
  if (typeof price === 'number') {
    const SDLT_BANDS: Array<{ threshold: number; rate: number }> = [
      { threshold: 125_000, rate: 0.03 },  // 0–£125k: 3%
      { threshold: 250_000, rate: 0.05 },  // £125k–£250k: 5%
      { threshold: 925_000, rate: 0.10 },  // £250k–£925k: 10%
      { threshold: 1_500_000, rate: 0.15 }, // £925k–£1.5m: 15%
      { threshold: Infinity, rate: 0.17 },  // >£1.5m: 17%
    ];
    let sdlt = 0;
    let remaining = price;
    let prevThreshold = 0;
    for (const band of SDLT_BANDS) {
      const bandSize = Math.min(remaining, band.threshold - prevThreshold);
      if (bandSize <= 0) break;
      sdlt += bandSize * band.rate;
      remaining -= bandSize;
      prevThreshold = band.threshold;
    }
    return `~${formatCurrency(Math.round(sdlt))} (est.)`;
  }
  return PENDING;
};

const buildFinancialBreakdown = (
  input: PropertyPdfExportInput,
  property: Record<string, unknown>,
  rentMonthly: number | undefined,
  price: number | undefined,
  derivedYield: number | undefined,
  derivedRoi: number | undefined,
  discountPercent: number | undefined,
): FinancialLineItem[] => {
  const legalFees = resolveFirstNumber(property, 'legal_fees', 'legalFees', 'conveyancing_fees', 'conveyancingFees');
  const sourcingFee = resolveFirstNumber(property, 'sourcing_fee', 'sourcingFee', 'sourcingFees');
  const councilTax = resolveFirstText(property, 'council_tax', 'councilTax', 'council_tax_band', 'councilTaxBand');
  const bills = resolveFirstText(property, 'bills', 'monthly_bills', 'monthlyBills', 'bills_estimate');
  const yearlyIncome = resolveFirstNumber(property, 'yearly_income', 'yearlyIncome', 'annual_income', 'annualIncome');
  const tenancyStatus = resolveFirstText(property, 'tenancy_status', 'tenancyStatus', 'tenants_in_situ', 'tenantsInSitu', 'tenancy');
  const hmoRoomRents = resolveFirstText(property, 'hmo_room_rents', 'hmoRoomRents', 'room_rents', 'roomRents');

  const investmentType = getText(property.investment_type ?? property.investmentType) ?? '';
  const isHmo = /hmo|multi[- ]?let/i.test(investmentType);

  const yearlyIncomeEstimate = typeof yearlyIncome === 'number'
    ? formatCurrency(yearlyIncome)
    : typeof rentMonthly === 'number'
    ? `~${formatCurrency(rentMonthly * 12)} (est.)`
    : PENDING;

  const lines: FinancialLineItem[] = [
    { label: 'Purchase Price', value: typeof price === 'number' ? formatCurrency(price) : PENDING, isPlaceholder: typeof price !== 'number', tier: 'core' },
    { label: 'Estimated Rent (PCM)', value: typeof rentMonthly === 'number' ? formatCurrency(rentMonthly) : PENDING, isPlaceholder: typeof rentMonthly !== 'number', tier: 'core' },
    { label: 'Gross Yield', value: typeof derivedYield === 'number' ? formatPercent(derivedYield) : PENDING, isPlaceholder: typeof derivedYield !== 'number', tier: 'core' },
    { label: 'ROI', value: typeof derivedRoi === 'number' ? formatPercent(derivedRoi) : PENDING, isPlaceholder: typeof derivedRoi !== 'number', tier: 'core' },
    { label: 'Discount', value: typeof discountPercent === 'number' ? formatPercent(discountPercent) : PENDING, isPlaceholder: typeof discountPercent !== 'number', tier: 'core' },
    { label: 'Stamp Duty (SDLT)', value: resolveStampDuty(property, price), isPlaceholder: false, tier: 'core' },
    { label: 'Yearly Income (Gross)', value: yearlyIncomeEstimate, isPlaceholder: typeof yearlyIncome !== 'number' && typeof rentMonthly !== 'number', tier: 'core' },
    { label: 'Legal Fees', value: typeof legalFees === 'number' ? formatCurrency(legalFees) : PENDING, isPlaceholder: typeof legalFees !== 'number', tier: 'extended' },
    { label: 'Sourcing Fee', value: typeof sourcingFee === 'number' ? formatCurrency(sourcingFee) : PENDING, isPlaceholder: typeof sourcingFee !== 'number', tier: 'extended' },
    { label: 'Council Tax', value: councilTax ?? PENDING, isPlaceholder: !councilTax, tier: 'extended' },
    { label: 'Bills', value: bills ?? PENDING, isPlaceholder: !bills, tier: 'extended' },
    { label: 'Tenancy Status', value: tenancyStatus ?? PENDING, isPlaceholder: !tenancyStatus, tier: 'extended' },
    ...(isHmo ? [{ label: 'HMO Room Rents', value: hmoRoomRents ?? PENDING, isPlaceholder: !hmoRoomRents, tier: 'extended' as const }] : []),
  ];

  return lines;
};

export const createPropertyPdfFilename = (input: PropertyPdfExportInput): string => {
  const property = input.property ?? {};
  const title = getText(property.title);
  const location = getText(property.location);
  const idPart = sanitizeFilenamePart(input.propertyId || 'property');
  const titlePart = sanitizeFilenamePart(title ?? location ?? 'property-details');
  const ymd = new Date().toISOString().slice(0, 10);
  return `propnexus-${titlePart}-${idPart}-${ymd}.pdf`;
};

export const getPropertyPdfSections = (input: PropertyPdfExportInput): PropertyPdfSections => {
  const property = input.property ?? {};
  const title = getText(property.title) ?? `Property ${input.propertyId}`;
  const location = getText(property.location) ?? 'Location unavailable';
  const propertyType = getText(property.propertyType ?? property.property_type) ?? 'Property type unavailable';
  const investmentType = getText(property.investmentType ?? property.investment_type) ?? 'Investment type unavailable';
  const description = getText(property.description);
  const bedrooms = toNumber(property.bedrooms);
  const bathrooms = toNumber(property.bathrooms);
  const bedroomBathroomValue = formatBedroomBathroomValue(bedrooms, bathrooms);
  const exportedAt = formatDate();
  const sourceUrl = input.url ?? 'Source URL unavailable';

  const price = typeof input.price === 'number' ? input.price : toNumber(property.price);
  const rent = resolveRentMonthly(property);
  const mergedMetricsSource: Record<string, unknown> = { ...property };
  if (typeof input.price === 'number') mergedMetricsSource.price = input.price;
  if (typeof input.yieldPercent === 'number') mergedMetricsSource.yield_percent = input.yieldPercent;
  if (typeof input.roiPercent === 'number') mergedMetricsSource.roi_percent = input.roiPercent;
  const derivedYield = getYieldPercent(mergedMetricsSource) ?? undefined;
  const derivedRoi = getRoiDisplay(mergedMetricsSource).value ?? undefined;
  const derivedDiscount =
    typeof input.discountPercent === 'number'
      ? input.discountPercent
      : toNumber(property.discount_percent ?? property.discount_estimate_pct);

  const metrics: ExportMetric[] = [
    { label: 'Price', value: formatCurrency(price) },
    { label: 'Estimated Rent (PCM)', value: formatCurrency(rent) },
    { label: 'Yield', value: formatPercent(derivedYield) },
    { label: 'ROI', value: formatPercent(derivedRoi) },
    { label: 'Discount', value: typeof derivedDiscount === 'number' ? formatPercent(derivedDiscount) : 'Pending' },
    { label: 'AI Score', value: typeof input.aiScore === 'number' ? `${input.aiScore.toFixed(1)}/10` : 'Not scored' },
  ];

  const overview: ExportMetric[] = [
    { label: 'Property ID', value: input.propertyId || 'N/A' },
    { label: 'Location', value: location },
    { label: 'Property Type', value: cleanPropertyType(propertyType) },
    { label: 'Investment Type', value: cleanInvestmentType(investmentType) },
    { label: 'Bedrooms / Bathrooms', value: bedroomBathroomValue },
    { label: 'Source URL', value: sourceUrl },
  ];

  const fallbackNotes = createEmptyNotesState(property);
  const highlights = extractDealHighlights(
    description,
    createFallbackHighlights(location, propertyType, investmentType, bedrooms, bathrooms),
  );
  const notes = createExecutiveSummary(
    description,
    fallbackNotes,
    location,
    propertyType,
    investmentType,
    bedrooms,
    bathrooms,
    highlights,
  );
  const investmentInsight = createInvestmentInsight(input);

  return {
    brandTitle: 'PropNexus',
    reportTitle: 'Investor Deal Pack',
    reportSubtitle: 'Investor-ready property brief prepared from the live PropNexus listing.',
    title,
    location,
    titleMeta: [
      { label: 'Property Type', value: cleanPropertyType(propertyType) },
      { label: 'Bedrooms / Bathrooms', value: bedroomBathroomValue },
      { label: 'Investment Type', value: cleanInvestmentType(investmentType) },
    ],
    metrics,
    highlights,
    investmentInsight,
    overview,
    notes,
    hasNarrativeDescription: Boolean(description),
    exportedAt,
    sourceUrl,
    imageUrl: resolvePrimaryImageUrl(property),
  };
};

const splitSummaryIntoParagraphs = (value: string): string[] => {
  const paragraphs = value
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return paragraphs.length ? paragraphs : [value];
};

const buildSummaryNote = (
  executiveSummary: string[],
): string[] => {
  const lines = executiveSummary.slice(0, 2).map((paragraph) => trimTextLength(paragraph, 180));
  return lines.length ? lines : ['Further underwriting inputs are not yet available.'];
};

export const buildPropertyDealPackModel = (input: PropertyPdfExportInput): PropertyDealPackModel => {
  const sections = getPropertyPdfSections(input);
  const property = input.property ?? {};

  const executiveSummary = splitSummaryIntoParagraphs(sections.notes);
  const executiveSummaryPreview =
    executiveSummary.length > 2 ? executiveSummary.slice(0, 2) : splitSummaryIntoParagraphs(trimTextLength(sections.notes, 220));

  const price = typeof input.price === 'number' ? input.price : toNumber(property.price);
  const rent = resolveRentMonthly(property);
  const mergedMetricsSource: Record<string, unknown> = { ...property };
  if (typeof input.price === 'number') mergedMetricsSource.price = input.price;
  if (typeof input.yieldPercent === 'number') mergedMetricsSource.yield_percent = input.yieldPercent;
  if (typeof input.roiPercent === 'number') mergedMetricsSource.roi_percent = input.roiPercent;
  const derivedYield = getYieldPercent(mergedMetricsSource) ?? undefined;
  const derivedRoi = getRoiDisplay(mergedMetricsSource).value ?? undefined;
  const derivedDiscount =
    typeof input.discountPercent === 'number'
      ? input.discountPercent
      : toNumber(property.discount_percent ?? property.discount_estimate_pct);

  const propertyType = getText(property.propertyType ?? property.property_type) ?? 'Property type unavailable';
  const investmentType = getText(property.investmentType ?? property.investment_type) ?? 'Investment type unavailable';
  const description = getText(property.description);
  const bedrooms = toNumber(property.bedrooms);
  const bathrooms = toNumber(property.bathrooms);

  const propertyDetails = buildPropertyDetailsSection(
    property,
  );

  const areaDemand = buildAreaDemandSection(property, rent);

  const financialBreakdown = buildFinancialBreakdown(
    input,
    property,
    rent,
    price,
    derivedYield,
    derivedRoi,
    derivedDiscount,
  );

  const summaryNote = buildSummaryNote(executiveSummary);

  const snapshotCards = sections.metrics.filter((metric) => ['Price', 'Yield', 'ROI', 'Discount'].includes(metric.label));
  const summarySnapshot = sections.metrics.filter((metric) => ['Estimated Rent (PCM)', 'AI Score'].includes(metric.label));
  const financialSnapshot = financialBreakdown.filter((item) => item.tier === 'core');
  const financialDetails = financialBreakdown.filter((item) => item.tier === 'extended' && !item.isPlaceholder);

  const hasPropertyDetails = countMeaningfulMetrics(propertyDetails) >= 1;
  const hasAreaDemand = countMeaningfulMetrics(areaDemand) >= 2;
  const hasFinancialDetails = countMeaningfulMetrics(financialDetails) >= 2;
  const supportingSections: DealPackSection[] = [];

  const summaryCharacterCount = executiveSummary.join(' ').length;
  const highlightsCharacterCount = sections.highlights.join(' ').length;
  const contentDensityScore =
    summaryCharacterCount +
    Math.round(highlightsCharacterCount * 0.65) +
    Math.round(sections.title.length * 1.15) +
    (sections.imageUrl ? 0 : 40) +
    (sections.sourceUrl.length > 160 ? 30 : 0) +
    (hasPropertyDetails ? 40 : 0) +
    (hasAreaDemand ? 55 : 0) +
    (hasFinancialDetails ? 30 : 0);

  const packMode = hasPropertyDetails || hasAreaDemand || hasFinancialDetails ? 'full' : 'lean';

  const requiresSecondPage =
    (description?.length ?? 0) > 900 ||
    executiveSummary.length > 3 ||
    summaryCharacterCount > 480 ||
    sections.highlights.length > 5 ||
    contentDensityScore > 590;

  return {
    filename: createPropertyPdfFilename(input),
    headline: sections.title,
    location: sections.location,
    propertyType: cleanPropertyType(propertyType),
    investmentType: cleanInvestmentType(investmentType),
    marketStatus: resolveMarketStatus(property),
    brandTitle: sections.brandTitle,
    reportTitle: sections.reportTitle,
    reportSubtitle: sections.reportSubtitle,
    metadataChips: sections.titleMeta,
    snapshotCards,
    highlights: sections.highlights,
    investmentInsight: sections.investmentInsight,
    propertyDetails: hasPropertyDetails ? propertyDetails : [],
    areaDemand: hasAreaDemand ? areaDemand : [],
    financialBreakdown,
    financialSnapshot,
    financialDetails: hasFinancialDetails ? financialDetails : [],
    executiveSummary,
    executiveSummaryPreview,
    summaryNote,
    summarySnapshot,
    supportingSections,
    exportedAt: sections.exportedAt,
    sourceUrl: sections.sourceUrl,
    sourceUrlDisplay: formatSourceUrlDisplay(sections.sourceUrl),
    imageUrl: sections.imageUrl,
    hasImage: Boolean(sections.imageUrl),
    hasNarrativeDescription: sections.hasNarrativeDescription,
    packMode,
    requiresSecondPage,
  };
};
