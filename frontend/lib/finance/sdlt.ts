/**
 * SDLT (Stamp Duty Land Tax) Calculator for England & Northern Ireland
 *
 * Supports:
 * - Standard residential rates
 * - Additional property surcharge (+3%)
 * - Non-resident surcharge (+2%)
 * - Combined additional + non-resident surcharge (+5%)
 */

export type BuyerType = 'standard' | 'additional' | 'nonresident' | 'additional_nonresident';

export interface SDLTBand {
  upTo: number | null; // null means infinity (top band)
  rate: number; // as decimal (0.05 = 5%)
  label: string;
}

export interface SDLTBandResult {
  label: string;
  taxable: number;
  ratePct: number;
  duty: number;
}

export interface SDLTCalculation {
  bands: SDLTBandResult[];
  baseTotal: number;
  surcharge: number;
  surchargeRate: number;
  total: number;
  effectiveRate: number;
}

/**
 * Standard residential SDLT bands (England & NI)
 */
const STANDARD_BANDS: SDLTBand[] = [
  { upTo: 250_000, rate: 0.0, label: 'Up to £250k' },
  { upTo: 925_000, rate: 0.05, label: '£250k–£925k' },
  { upTo: 1_500_000, rate: 0.1, label: '£925k–£1.5m' },
  { upTo: null, rate: 0.12, label: '£1.5m+' },
];

/**
 * Calculate SDLT for a given property price and buyer type
 *
 * @param price Property price in GBP
 * @param buyerType Type of buyer (determines surcharges)
 * @returns SDLT calculation with band breakdown
 */
export function calculateSDLT(price: number, buyerType: BuyerType = 'standard'): SDLTCalculation {
  // Ensure price is non-negative
  const safePrice = Math.max(0, price);

  // Calculate base duty using bands
  let remaining = safePrice;
  let lastCap = 0;
  let baseTotal = 0;
  const bands: SDLTBandResult[] = [];

  for (const band of STANDARD_BANDS) {
    const cap = band.upTo ?? Infinity;
    const slice = Math.max(0, Math.min(remaining, cap - lastCap));
    const duty = slice * band.rate;

    bands.push({
      label: band.label,
      taxable: slice,
      ratePct: band.rate * 100,
      duty: duty,
    });

    baseTotal += duty;
    remaining -= slice;
    lastCap = cap;

    if (remaining <= 0) break;
  }

  // Calculate surcharges
  let surchargeRate = 0;
  if (buyerType === 'additional') {
    surchargeRate = 0.03; // +3% for additional property
  } else if (buyerType === 'nonresident') {
    surchargeRate = 0.02; // +2% for non-resident
  } else if (buyerType === 'additional_nonresident') {
    surchargeRate = 0.05; // +5% for both
  }

  const surcharge = safePrice * surchargeRate;
  const total = baseTotal + surcharge;
  const effectiveRate = safePrice > 0 ? (total / safePrice) : 0;

  return {
    bands,
    baseTotal: Math.round(baseTotal),
    surcharge: Math.round(surcharge),
    surchargeRate,
    total: Math.round(total),
    effectiveRate,
  };
}

/**
 * Format currency in GBP without decimals
 */
export function formatGBP(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get a human-readable label for buyer type
 */
export function getBuyerTypeLabel(buyerType: BuyerType): string {
  switch (buyerType) {
    case 'standard':
      return 'Standard residential';
    case 'additional':
      return 'Additional property (+3%)';
    case 'nonresident':
      return 'Non-resident (+2%)';
    case 'additional_nonresident':
      return 'Additional + Non-resident (+5%)';
    default:
      return 'Unknown';
  }
}
