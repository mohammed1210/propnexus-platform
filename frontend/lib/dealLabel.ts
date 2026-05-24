import { parseRent } from '@/lib/normalizeProperty';

export type DealLabelCode =
  | 'prime_deal'
  | 'strong_deal'
  | 'fair_deal'
  | 'needs_review'
  | 'high_risk'
  | 'insufficient_evidence';

export type DealLabelTone = 'emerald' | 'blue' | 'amber' | 'rose' | 'slate';

export type DealLabelSignal = {
  key: string;
  label: string;
  points: number;
  max: number;
  tone: DealLabelTone;
  detail: string;
};

export type DealLabelResult = {
  code: DealLabelCode;
  label: string;
  score: number;
  confidence: number;
  tone: DealLabelTone;
  summary: string;
  shortReason: string;
  pricePositionLabel: string;
  strongestSignals: string[];
  mainRisks: string[];
  signals: DealLabelSignal[];
  calculations: {
    askingPrice: number | null;
    soldBenchmark: number | null;
    soldBenchmarkSource: string | null;
    priceDiscountPct: number | null;
    grossYieldPct: number | null;
    monthlyRent: number | null;
    rentEvidence: 'direct' | 'derived' | 'missing';
    priceReductionPct: number | null;
    compsCount: number | null;
    imagesCount: number;
    positiveListingSignals: string[];
    riskListingSignals: string[];
    dataQualityPoints: number;
    penalties: Array<{ label: string; points: number }>;
  };
};

const LABELS: Record<DealLabelCode, { label: string; tone: DealLabelTone }> = {
  prime_deal: { label: 'Prime Deal', tone: 'emerald' },
  strong_deal: { label: 'Strong Deal', tone: 'blue' },
  fair_deal: { label: 'Fair Deal', tone: 'amber' },
  needs_review: { label: 'Needs Review', tone: 'amber' },
  high_risk: { label: 'High Risk', tone: 'rose' },
  insufficient_evidence: { label: 'Evidence Needed', tone: 'slate' },
};

const POSITIVE_SIGNAL_PATTERNS: Array<{ label: string; pattern: RegExp; points: number }> = [
  { label: 'Chain-free or vacant possession', pattern: /chain\s*free|no onward chain|vacant possession/i, points: 3 },
  { label: 'Auction or motivated pricing language', pattern: /auction|guide price|offers over|oieo|motivated seller|priced to sell/i, points: 3 },
  { label: 'Value-add or refurbishment wording', pattern: /refurb|renovat|modernis|\btlc\b|project|value[-\s]?add|scope to improve/i, points: 3 },
  { label: 'Extension or planning upside', pattern: /extension|planning|loft conversion|\bstpp\b/i, points: 2 },
];

const RISK_SIGNAL_PATTERNS: Array<{ label: string; pattern: RegExp; points: number }> = [
  { label: 'Cash buyer only', pattern: /cash buyer only|cash buyers only/i, points: 4 },
  { label: 'Short lease', pattern: /short lease/i, points: 4 },
  { label: 'Unmortgageable', pattern: /unmortgageable/i, points: 5 },
  { label: 'Structural issue', pattern: /structural|subsidence/i, points: 5 },
  { label: 'Legal pack risk', pattern: /legal pack risk|legal pack/i, points: 3 },
];

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function cleanNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.\-]/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function getPath(source: any, path: string): unknown {
  return path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), source);
}

function firstNumber(source: any, paths: string[]): number | null {
  for (const path of paths) {
    const value = cleanNumber(getPath(source, path));
    if (value !== null) return value;
  }
  return null;
}

function firstString(source: any, paths: string[]): string | null {
  for (const path of paths) {
    const value = getPath(source, path);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function firstRent(source: any, paths: string[]): number | null {
  for (const path of paths) {
    const value = parseRent(getPath(source, path));
    if (value !== null && Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function extractBenchmarkObject(value: unknown): number | null {
  const direct = cleanNumber(value);
  if (direct !== null) return direct;
  if (!value || typeof value !== 'object') return null;
  return firstNumber(value, [
    'value',
    'price',
    'benchmark',
    'benchmark_price',
    'benchmarkPrice',
    'median',
    'median_price',
    'medianPrice',
    'avg',
    'average',
    'average_price',
    'avg_price',
    'sold_price',
    'soldPrice',
  ]);
}

function getSoldBenchmark(property: any): { value: number | null; source: string | null } {
  const candidates = [
    { path: 'sold_comp_benchmark', label: 'sold comp benchmark' },
    { path: 'soldCompBenchmark', label: 'sold comp benchmark' },
    { path: 'comps.sales_benchmark', label: 'sales benchmark' },
    { path: 'sold_comp_avg', label: 'average sold comp' },
    { path: 'sold_comp_median', label: 'median sold comp' },
    { path: 'avg_sale_comp', label: 'average sale comp' },
    { path: 'derived.compsMedianSold', label: 'derived comps median' },
    { path: 'compsMedianSold', label: 'derived comps median' },
    { path: 'estimated_value', label: 'estimated value' },
    { path: 'market_value', label: 'market value' },
  ];

  for (const candidate of candidates) {
    const value = extractBenchmarkObject(getPath(property, candidate.path));
    if (value !== null) return { value, source: candidate.label };
  }
  return { value: null, source: null };
}

function getCompsCount(property: any): number | null {
  const direct = firstNumber(property, ['comps_count', 'compsCount', 'derived.compsCount']);
  if (direct !== null) return Math.round(direct);
  const sales = getPath(property, 'comps.sales');
  return Array.isArray(sales) ? sales.length : null;
}

function getImageCount(property: any): number {
  const imageUrls = property?.image_urls ?? property?.imageUrls;
  if (Array.isArray(imageUrls)) return imageUrls.filter(Boolean).length + (property?.imageurl ? 1 : 0);
  if (typeof imageUrls === 'string' && imageUrls.trim()) {
    try {
      const parsed = JSON.parse(imageUrls);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).length + (property?.imageurl ? 1 : 0);
    } catch {
      return 1 + (property?.imageurl ? 1 : 0);
    }
  }
  return property?.imageurl ? 1 : 0;
}

function getRent(property: any, askingPrice: number | null): { monthlyRent: number | null; evidence: 'direct' | 'derived' | 'missing' } {
  const directMonthly = firstRent(property, [
    'monthly_rent',
    'rent_pcm',
    'rent_per_month',
    'rental_evidence.monthly_rent',
    'rental_evidence.rent_pcm',
    'rental_evidence.rent_per_month',
    'rentalEvidence.monthlyRent',
  ]);
  if (directMonthly !== null) return { monthlyRent: directMonthly, evidence: 'direct' };

  const derived = firstNumber(property, ['derived.rentMonthly', 'rentMonthly']);
  if (derived !== null) return { monthlyRent: derived, evidence: 'derived' };

  const directRent = firstRent(property, ['rent', 'rental_evidence.rent', 'rentalEvidence.rent']);
  if (directRent !== null) return { monthlyRent: directRent, evidence: 'direct' };

  const yieldPct = firstNumber(property, ['yield_percent', 'gross_yield', 'rental_yield', 'derived.grossYieldPct', 'displayYieldPct']);
  if (askingPrice && yieldPct !== null) return { monthlyRent: (askingPrice * yieldPct) / 100 / 12, evidence: 'derived' };

  return { monthlyRent: null, evidence: 'missing' };
}

function getGrossYield(property: any, askingPrice: number | null, monthlyRent: number | null): number | null {
  const direct = firstNumber(property, ['yield_percent', 'gross_yield', 'rental_yield', 'derived.grossYieldPct', 'displayYieldPct']);
  if (direct !== null) return direct > 1 || direct === 0 ? direct : direct * 100;
  if (askingPrice && monthlyRent) return (monthlyRent * 12 * 100) / askingPrice;
  return null;
}

function getPriceReductionPct(property: any, askingPrice: number | null): number | null {
  if (!askingPrice) return null;
  const previous = firstNumber(property, ['previous_price', 'initial_price']);
  const history = property?.price_history ?? property?.priceHistory;
  const historyPrices = Array.isArray(history)
    ? history.map((item) => cleanNumber(item?.price ?? item?.asking_price ?? item?.value)).filter((value): value is number => value !== null)
    : [];
  const oldPrice = Math.max(previous ?? 0, ...historyPrices, 0);
  if (!oldPrice || oldPrice <= askingPrice) return null;
  return ((oldPrice - askingPrice) * 100) / oldPrice;
}

function scorePricePosition(discountPct: number | null): number {
  if (discountPct === null) return 0;
  if (discountPct >= 18) return 35;
  if (discountPct >= 12) return 30;
  if (discountPct >= 7) return 24;
  if (discountPct >= 3) return 17;
  if (discountPct >= -3) return 10;
  if (discountPct >= -10) return 3;
  return 0;
}

function scoreYield(yieldPct: number | null): number {
  if (yieldPct === null) return 0;
  if (yieldPct >= 8) return 20;
  if (yieldPct >= 7) return 18;
  if (yieldPct >= 6) return 15;
  if (yieldPct >= 5) return 10;
  if (yieldPct >= 4) return 5;
  return 1;
}

function scoreReduction(reductionPct: number | null): number {
  if (reductionPct === null) return 0;
  if (reductionPct >= 15) return 12;
  if (reductionPct >= 10) return 10;
  if (reductionPct >= 5) return 7;
  if (reductionPct >= 2) return 4;
  return 0;
}

function pricePositionLabel(discountPct: number | null): string {
  if (discountPct === null) return 'No sold benchmark available';
  if (discountPct >= 18) return `${formatPct(discountPct)} below sold benchmark`;
  if (discountPct >= 7) return `${formatPct(discountPct)} below sold benchmark`;
  if (discountPct >= 3) return `Slightly below benchmark (${formatPct(discountPct)})`;
  if (discountPct >= -3) return 'Near sold benchmark';
  return `${formatPct(Math.abs(discountPct))} above sold benchmark`;
}

function getText(property: any): string {
  const textParts = [
    property?.title,
    property?.description,
    property?.property_type,
    property?.propertyType,
    property?.investment_type,
    property?.investmentType,
    ...(Array.isArray(property?.top_deal_reasons) ? property.top_deal_reasons : []),
    ...(Array.isArray(property?.deal_reasons) ? property.deal_reasons : []),
    ...(Array.isArray(property?.deal_signals) ? property.deal_signals : []),
  ];
  return textParts.filter((value) => typeof value === 'string' && value.trim()).join(' ');
}

function buildSummary(code: DealLabelCode, priceLabel: string, yieldPct: number | null, evidence: 'direct' | 'derived' | 'missing'): string {
  const yieldText = yieldPct !== null ? `${formatPct(yieldPct)} gross yield` : 'yield evidence missing';
  const rentText = evidence === 'direct' ? 'direct rent evidence' : evidence === 'derived' ? 'derived rent evidence' : 'no rent evidence';
  if (code === 'prime_deal') return `Strong evidence: ${priceLabel}, ${yieldText}, and ${rentText}. Complete diligence before offering.`;
  if (code === 'strong_deal') return `Promising investor label based on ${priceLabel}, ${yieldText}, and ${rentText}. Verify the assumptions before bidding.`;
  if (code === 'fair_deal') return `Reasonable evidence profile, but the property does not yet show enough edge for a premium deal label.`;
  if (code === 'needs_review') return `Some useful signals are present, but missing evidence or risk wording means this needs manual investor review.`;
  if (code === 'high_risk') return `The available evidence is weak or risk-heavy. Treat the listing as high diligence before considering an offer.`;
  return `Evidence is too limited for a confident investor deal label. Add comparable sales, rent evidence and listing source checks.`;
}

function compactReason(result: Pick<DealLabelResult, 'code' | 'calculations' | 'pricePositionLabel'>): string {
  if (result.code === 'insufficient_evidence') return 'Not enough comps or rent evidence yet.';
  if (result.calculations.priceDiscountPct !== null && result.calculations.priceDiscountPct >= 7) return result.pricePositionLabel;
  if (result.calculations.grossYieldPct !== null && result.calculations.grossYieldPct >= 6) return `${formatPct(result.calculations.grossYieldPct)} gross yield`;
  if (result.calculations.priceReductionPct !== null && result.calculations.priceReductionPct >= 5) return `${formatPct(result.calculations.priceReductionPct)} price reduction`;
  return result.calculations.rentEvidence === 'missing' ? 'Rent evidence needs checking.' : 'Evidence supports cautious review.';
}

export function formatMoney(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'N/A';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPct(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'N/A';
  return `${value.toFixed(1)}%`;
}

export function getDealLabelLegalCopy(): string {
  return 'PropNexus deal labels are indicative only and are based on available listing, rental and comparable-market data. They are not formal valuations, financial advice, mortgage advice, tax advice or legal advice. Investors should verify all figures and seek professional advice before making an offer.';
}

export function computeDealLabel(property: any): DealLabelResult {
  const askingPrice = firstNumber(property, ['price', 'asking_price', 'guide_price']);
  const benchmark = getSoldBenchmark(property);
  const compsCount = getCompsCount(property);
  const rent = getRent(property, askingPrice);
  const grossYieldPct = getGrossYield(property, askingPrice, rent.monthlyRent);
  const priceReductionPct = getPriceReductionPct(property, askingPrice);
  const priceDiscountPct = askingPrice && benchmark.value ? ((benchmark.value - askingPrice) * 100) / benchmark.value : null;
  const imagesCount = getImageCount(property);
  const postcode = firstString(property, ['postcode', 'postal_code', 'postalCode', 'postcode_full', 'postcodeFull']);
  const sourceUrl = firstString(property, ['source_url', 'listing_url', 'original_url', 'property_url', 'external_url', 'rightmove_url', 'zoopla_url', 'onthemarket_url']);
  const text = getText(property);

  const positiveListingSignals = POSITIVE_SIGNAL_PATTERNS.filter((signal) => signal.pattern.test(text));
  const riskListingSignals = RISK_SIGNAL_PATTERNS.filter((signal) => signal.pattern.test(text));
  const listingPoints = clamp(
    positiveListingSignals.reduce((sum, signal) => sum + signal.points, 0) - riskListingSignals.reduce((sum, signal) => sum + signal.points, 0),
    0,
    10,
  );
  const rentEvidencePoints = rent.evidence === 'direct' ? 12 : rent.evidence === 'derived' ? 9 : 0;
  const pricePoints = scorePricePosition(priceDiscountPct);
  const yieldPoints = scoreYield(grossYieldPct);
  const reductionPoints = scoreReduction(priceReductionPct);

  let dataQualityPoints = 0;
  if (askingPrice) dataQualityPoints += 3;
  if (benchmark.value) dataQualityPoints += 3;
  if ((compsCount ?? 0) >= 3) dataQualityPoints += 3;
  if (rent.evidence !== 'missing') dataQualityPoints += 3;
  if (postcode) dataQualityPoints += 2;
  if (sourceUrl) dataQualityPoints += 1;
  if (imagesCount >= 3) dataQualityPoints += 1;

  const penalties: Array<{ label: string; points: number }> = [];
  if (!askingPrice) penalties.push({ label: 'Missing asking price', points: -14 });
  if (!benchmark.value && rent.evidence === 'missing') penalties.push({ label: 'Missing comps and rent evidence', points: -18 });
  if (!benchmark.value) penalties.push({ label: 'Missing sold benchmark', points: -8 });
  if (rent.evidence === 'missing') penalties.push({ label: 'Missing rent evidence', points: -7 });
  if (priceDiscountPct !== null && priceDiscountPct < -10) penalties.push({ label: 'More than 10% above benchmark', points: -12 });
  if (grossYieldPct !== null && grossYieldPct > 35) penalties.push({ label: 'Unrealistic yield above 35%', points: -8 });
  if (riskListingSignals.length) penalties.push({ label: 'Specialist risk wording found', points: -Math.min(8, riskListingSignals.length * 3) });

  const rawScore = pricePoints + yieldPoints + rentEvidencePoints + reductionPoints + listingPoints + dataQualityPoints + penalties.reduce((sum, item) => sum + item.points, 0);
  const score = Math.round(clamp(rawScore));
  const confidence = Math.round(clamp(
    (dataQualityPoints / 16) * 70
      + (benchmark.value ? 10 : 0)
      + (rent.evidence === 'direct' ? 12 : rent.evidence === 'derived' ? 8 : 0)
      + ((compsCount ?? 0) >= 3 ? 8 : 0)
      - (riskListingSignals.length ? 5 : 0),
  ));
  const hasStrongValueSignal = (priceDiscountPct !== null && priceDiscountPct >= 7) || (grossYieldPct !== null && grossYieldPct >= 6.5);

  let code: DealLabelCode;
  if (confidence < 18) code = 'insufficient_evidence';
  else if (score >= 82 && confidence >= 55 && hasStrongValueSignal) code = 'prime_deal';
  else if (score >= 68 && confidence >= 40 && hasStrongValueSignal) code = 'strong_deal';
  else if (score >= 50) code = 'fair_deal';
  else if (score >= 35) code = 'needs_review';
  else code = 'high_risk';

  const priceLabel = pricePositionLabel(priceDiscountPct);
  const signals: DealLabelSignal[] = [
    { key: 'price_position', label: 'Price position', points: pricePoints, max: 35, tone: pricePoints >= 24 ? 'emerald' : pricePoints >= 10 ? 'amber' : 'slate', detail: priceLabel },
    { key: 'gross_yield', label: 'Gross yield', points: yieldPoints, max: 20, tone: yieldPoints >= 15 ? 'emerald' : yieldPoints >= 5 ? 'amber' : 'slate', detail: grossYieldPct !== null ? `${formatPct(grossYieldPct)} estimated gross yield` : 'No yield evidence available' },
    { key: 'rent_evidence', label: 'Rent evidence', points: rentEvidencePoints, max: 12, tone: rentEvidencePoints >= 9 ? 'emerald' : 'slate', detail: rent.evidence === 'direct' ? 'Direct property rent evidence found' : rent.evidence === 'derived' ? 'Derived rent evidence found' : 'No rent evidence found' },
    { key: 'price_reduction', label: 'Price reduction', points: reductionPoints, max: 12, tone: reductionPoints >= 7 ? 'emerald' : reductionPoints > 0 ? 'amber' : 'slate', detail: priceReductionPct !== null ? `${formatPct(priceReductionPct)} reduction from previous price` : 'No verified reduction found' },
    { key: 'listing_signals', label: 'Listing signals', points: listingPoints, max: 10, tone: listingPoints >= 6 ? 'emerald' : riskListingSignals.length ? 'rose' : 'slate', detail: positiveListingSignals.length ? positiveListingSignals.map((signal) => signal.label).join(', ') : 'No value-add listing wording found' },
    { key: 'data_quality', label: 'Data quality', points: dataQualityPoints, max: 16, tone: dataQualityPoints >= 12 ? 'emerald' : dataQualityPoints >= 7 ? 'amber' : 'rose', detail: 'Asking price, comps, rent, postcode, URL and image coverage' },
  ];
  const strongestSignals = signals
    .filter((signal) => signal.points > 0)
    .sort((a, b) => b.points / b.max - a.points / a.max)
    .slice(0, 4)
    .map((signal) => `${signal.label}: ${signal.detail}`);
  const mainRisks = [
    ...penalties.map((penalty) => penalty.label),
    ...riskListingSignals.map((signal) => signal.label),
    'Verify condition, lease, EPC, finance, fees and legal pack before offering',
  ].filter((value, index, arr) => arr.indexOf(value) === index).slice(0, 5);

  const partial: DealLabelResult = {
    code,
    label: LABELS[code].label,
    score,
    confidence,
    tone: LABELS[code].tone,
    summary: buildSummary(code, priceLabel, grossYieldPct, rent.evidence),
    shortReason: '',
    pricePositionLabel: priceLabel,
    strongestSignals: strongestSignals.length ? strongestSignals : ['Evidence base is limited; validate comps and rent first'],
    mainRisks,
    signals,
    calculations: {
      askingPrice,
      soldBenchmark: benchmark.value,
      soldBenchmarkSource: benchmark.source,
      priceDiscountPct,
      grossYieldPct,
      monthlyRent: rent.monthlyRent,
      rentEvidence: rent.evidence,
      priceReductionPct,
      compsCount,
      imagesCount,
      positiveListingSignals: positiveListingSignals.map((signal) => signal.label),
      riskListingSignals: riskListingSignals.map((signal) => signal.label),
      dataQualityPoints,
      penalties,
    },
  };

  return { ...partial, shortReason: compactReason(partial) };
}
