import { normalizeProperty, parseMoney, parseRent } from '@/lib/normalizeProperty';

export type ScoreBreakdown = {
  version?: string;
  categories?: Record<string, number>;
  inputs?: Record<string, unknown>;
} | null | undefined;

export type AreaIntelEvidence = {
  avg_rent?: number | null;
  rent_source?: string | null;
  rent_evidence_count?: number | null;
  rent_estimate_count?: number | null;
  crime_source?: string | null;
  crime_count?: number | null;
  crime_signal?: string | null;
  crime_period?: string | null;
  schools_rating?: number | null;
  source_details?: Record<string, unknown> | null;
} | null | undefined;

export type CompLine = {
  price?: number | null;
  rent_monthly?: number | null;
  date?: string | null;
  source?: string | null;
};

export type CompsEvidence = {
  sales?: CompLine[] | null;
  rents?: CompLine[] | null;
  source_details?: Record<string, unknown> | null;
} | null | undefined;

export type DisplayScoreFactor = {
  key: string;
  label: string;
  value: number;
  source: 'property' | 'area_intel' | 'comps' | 'derived' | 'unavailable';
  helper: string;
  visible: boolean;
  displayValue: string;
  badge: string;
  tone: 'emerald' | 'amber' | 'rose' | 'brand' | 'slate';
};

type BuildArgs = {
  property: Record<string, unknown>;
  score_breakdown?: ScoreBreakdown;
  areaIntel?: AreaIntelEvidence;
  comps?: CompsEvidence;
};

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function fmtPct(value: number): string {
  return `${round1(value).toFixed(1)}%`;
}

function sourceDetail(details: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = details?.[key];
  return typeof value === 'string' ? value : null;
}

function firstRent(property: Record<string, unknown>): number | null {
  const keys = [
    'rent',
    'rent_monthly',
    'rentMonthly',
    'rent_pcm',
    'rentPcm',
    'rent_per_month',
    'rentPerMonth',
    'monthly_rent',
    'monthlyRent',
  ];
  for (const key of keys) {
    const rent = parseRent(property[key]);
    if (finiteNumber(rent) && rent > 0) return rent;
  }
  return null;
}

function latestSaleWithinMonths(sales: CompLine[], months: number): boolean {
  const cutoff = Date.now() - months * 31 * 24 * 60 * 60 * 1000;
  return sales.some((sale) => {
    if (!sale.date) return false;
    const time = Date.parse(String(sale.date));
    return Number.isFinite(time) && time >= cutoff;
  });
}

function ptrSignalFromRatio(ratio: number): number {
  if (ratio <= 12) return 100;
  if (ratio >= 25) return 0;
  return clamp(((25 - ratio) / 13) * 100);
}

function crimeSignalScore(signal: string | null, count: number | null): number | null {
  const normalized = (signal || '').toLowerCase();
  if (normalized === 'low') return 85;
  if (normalized === 'moderate') return 55;
  if (normalized === 'elevated') return 25;
  if (finiteNumber(count)) {
    if (count <= 30) return 85;
    if (count <= 80) return 55;
    return 25;
  }
  return null;
}

function demandLabel(score: number): string {
  if (score >= 75) return 'Strong';
  if (score >= 45) return 'Moderate';
  return 'Limited';
}

function valueTone(value: number): DisplayScoreFactor['tone'] {
  if (value >= 70) return 'emerald';
  if (value >= 45) return 'amber';
  return 'rose';
}

export function buildDealScoreFactors({
  property,
  score_breakdown,
  areaIntel,
  comps,
}: BuildArgs): DisplayScoreFactor[] {
  const normalized = normalizeProperty(property as any);
  const factors: DisplayScoreFactor[] = [];
  const price = normalized.price ?? parseMoney(property.price) ?? parseMoney(property.asking_price);
  const categories = score_breakdown?.categories ?? {};
  const sales = Array.isArray(comps?.sales) ? comps.sales.filter(Boolean) : [];
  const compRents = Array.isArray(comps?.rents) ? comps.rents.filter(Boolean) : [];
  const rentSource = areaIntel?.rent_source || sourceDetail(areaIntel?.source_details, 'rent');
  const areaRentEvidence =
    rentSource === 'internal_property_listings' || rentSource === 'derived_internal_estimate'
      ? areaIntel?.avg_rent
      : null;
  const propertyRent = firstRent(property);
  const monthlyRent = propertyRent || (finiteNumber(areaRentEvidence) && areaRentEvidence > 0 ? areaRentEvidence : null);
  const rentEvidenceSource = propertyRent
    ? 'property'
    : rentSource === 'internal_property_listings' || rentSource === 'derived_internal_estimate'
      ? 'area_intel'
      : 'unavailable';
  const rentEvidenceCount = Math.max(
    0,
    Number(areaIntel?.rent_evidence_count || 0),
    compRents.length,
  );
  const rentEstimateCount = Math.max(0, Number(areaIntel?.rent_estimate_count || 0));

  if (finiteNumber(normalized.yieldPercent) && normalized.yieldPercent > 0) {
    const fallback = finiteNumber(categories.yield) ? (categories.yield / 20) * 100 : normalized.yieldPercent * 10;
    factors.push({
      key: 'yield',
      label: 'Rental Yield',
      value: Math.round(clamp(fallback)),
      source: 'property',
      helper: 'Gross yield from property price and rent evidence.',
      visible: true,
      displayValue: fmtPct(normalized.yieldPercent),
      badge: 'Property data',
      tone: valueTone(clamp(fallback)),
    });
  }

  const roiValue = normalized.roiPercent ?? normalized.roiProxyPercent;
  if (finiteNumber(roiValue) && roiValue > 0) {
    const fallback = finiteNumber(categories.roi) ? (categories.roi / 20) * 100 : roiValue * 10;
    factors.push({
      key: 'roi',
      label: normalized.roiIsProxy ? 'ROI Proxy' : 'ROI',
      value: Math.round(clamp(fallback)),
      source: normalized.roiIsProxy ? 'derived' : 'property',
      helper: normalized.roiIsProxy
        ? 'Proxy return estimate; validate costs, finance and rent before relying on it.'
        : 'Return potential from property data.',
      visible: true,
      displayValue: fmtPct(roiValue),
      badge: normalized.roiIsProxy ? 'Derived' : 'Property data',
      tone: valueTone(clamp(fallback)),
    });
  }

  if (finiteNumber(price) && price > 0 && finiteNumber(monthlyRent) && monthlyRent > 0) {
    const ratio = price / (monthlyRent * 12);
    const value = ptrSignalFromRatio(ratio);
    factors.push({
      key: 'price_to_rent',
      label: 'Price-to-Rent',
      value: Math.round(value),
      source: rentEvidenceSource,
      helper: 'Asking price compared with annualised rent evidence.',
      visible: rentEvidenceSource !== 'unavailable',
      displayValue: `${round1(ratio).toFixed(1)}x`,
      badge: rentEvidenceSource === 'property' ? 'Property data' : 'Rent evidence',
      tone: valueTone(value),
    });
  }

  const salesCount = sales.length;
  const hasDemandEvidence = salesCount > 0 || rentEvidenceCount > 0 || rentEstimateCount > 0;
  if (hasDemandEvidence) {
    const salePoints = Math.min(salesCount, 8) / 8 * 45;
    const rentEvidenceUnits = rentEvidenceCount > 0 ? Math.min(rentEvidenceCount, 5) : Math.min(rentEstimateCount, 5) * 0.6;
    const rentPoints = Math.min(rentEvidenceUnits, 5) / 5 * 35;
    const recentPoints = latestSaleWithinMonths(sales, 12) ? 20 : 0;
    const value = clamp(salePoints + rentPoints + recentPoints);
    factors.push({
      key: 'area_demand',
      label: 'Area Demand',
      value: Math.round(value),
      source: salesCount > 0 ? 'comps' : 'area_intel',
      helper: 'Based on transaction volume, rental evidence and recent market activity.',
      visible: true,
      displayValue: demandLabel(value),
      badge: salesCount > 0 ? 'Land Registry PPD' : 'Rent evidence',
      tone: valueTone(value),
    });
  }

  const crimeSource = areaIntel?.crime_source;
  const crimeCount = finiteNumber(areaIntel?.crime_count) ? areaIntel.crime_count : null;
  if (crimeSource === 'police.uk' && crimeCount !== null) {
    const value = crimeSignalScore(areaIntel?.crime_signal || null, crimeCount);
    if (value !== null) {
      factors.push({
        key: 'reported_crime',
        label: 'Reported Crime Signal',
        value,
        source: 'area_intel',
        helper: 'police.uk reported incident count. Not a safety rating.',
        visible: true,
        displayValue: areaIntel?.crime_signal ? String(areaIntel.crime_signal) : `${crimeCount} reports`,
        badge: areaIntel?.crime_period ? `police.uk • ${areaIntel.crime_period}` : 'police.uk',
        tone: valueTone(value),
      });
    }
  }

  const schoolsSource = sourceDetail(areaIntel?.source_details, 'schools');
  if (schoolsSource && schoolsSource !== 'not_available' && finiteNumber(areaIntel?.schools_rating)) {
    const value = clamp((areaIntel.schools_rating / 5) * 100);
    factors.push({
      key: 'schools_access',
      label: 'Schools Access',
      value: Math.round(value),
      source: 'area_intel',
      helper: 'Backed by live schools source data.',
      visible: true,
      displayValue: `${round1(areaIntel.schools_rating).toFixed(1)}/5`,
      badge: 'Schools source',
      tone: valueTone(value),
    });
  }

  return factors.filter((factor) => factor.visible && factor.source !== 'unavailable').slice(0, 5);
}
