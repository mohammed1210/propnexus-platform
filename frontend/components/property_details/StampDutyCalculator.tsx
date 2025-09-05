'use client';
import React, { useEffect, useMemo, useState } from 'react';

type BuyerType = 'standard' | 'first_time' | 'additional';

interface StampDutyCalculatorProps {
  /** Seed price; user can still edit locally */
  price: number;
  className?: string;
}

type Band = { upTo: number | null; rate: number; label: string };

const BANDS_STANDARD: Band[] = [
  { upTo: 250_000, rate: 0.0,  label: 'Up to £250k' },
  { upTo: 925_000, rate: 0.05, label: '£250k–£925k' },
  { upTo: 1_500_000, rate: 0.10, label: '£925k–£1.5m' },
  { upTo: null,     rate: 0.12, label: '£1.5m+' },
];

// First-time buyer relief (England & NI): 0% up to 425k, 5% on 425–625k, over 625k → standard
const BANDS_FTB: Band[] = [
  { upTo: 425_000, rate: 0.0,  label: 'Up to £425k (FTB relief)' },
  { upTo: 625_000, rate: 0.05, label: '£425k–£625k (FTB relief)' },
];

const fmtGBP0 = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

/** Calculate SDLT for a price using the provided band array. */
function calcFromBands(price: number, bands: Band[]) {
  let remaining = Math.max(price, 0);
  let lastCap = 0;
  let total = 0;
  const rows: { label: string; taxable: number; ratePct: number; duty: number }[] = [];

  for (const b of bands) {
    const cap = b.upTo ?? Infinity;
    const slice = Math.max(0, Math.min(remaining, cap - lastCap));
    const duty = slice * b.rate;
    rows.push({ label: b.label, taxable: slice, ratePct: b.rate * 100, duty });
    total += duty;
    remaining -= slice;
    lastCap = cap;
    if (remaining <= 0) break;
  }
  return { rows, total };
}

export default function StampDutyCalculator({ price, className }: StampDutyCalculatorProps) {
  const [buyerType, setBuyerType] = useState<BuyerType>('standard');
  const [inputPrice, setInputPrice] = useState<number>(price);

  // Keep local input synced to prop changes
  useEffect(() => setInputPrice(price), [price]);

  const baseline = useMemo(() => {
    if (buyerType === 'first_time') {
      return inputPrice <= 625_000
        ? calcFromBands(inputPrice, BANDS_FTB)
        : calcFromBands(inputPrice, BANDS_STANDARD);
    }
    return calcFromBands(inputPrice, BANDS_STANDARD);
  }, [buyerType, inputPrice]);

  // +3% surcharge applies to the entire consideration for “additional”
  const surcharge = buyerType === 'additional' ? Math.max(inputPrice, 0) * 0.03 : 0;
  const totalDuty = Math.round(Math.max(0, baseline.total + surcharge));

  return (
    <div className={`bg-white dark:bg-neutral-900 shadow-md rounded-md p-5 mt-6 ${className ?? ''}`}>
      <h3 className="text-lg font-semibold mb-4">🏛️ Stamp Duty Calculator</h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="sdlt-price">Property Price (£)</label>
          <input
            id="sdlt-price"
            type="number"
            inputMode="numeric"
            min={0}
            value={Number.isFinite(inputPrice) ? inputPrice : 0}
            onChange={(e) => setInputPrice(Math.max(0, Number(e.target.value || 0)))}
            className="w-full border rounded px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="sdlt-type">Buyer Type</label>
          <select
            id="sdlt-type"
            className="w-full border rounded px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700"
            value={buyerType}
            onChange={(e) => setBuyerType(e.target.value as BuyerType)}
          >
            <option value="standard">Standard residential</option>
            <option value="first_time">First-time buyer</option>
            <option value="additional">Additional property (+3%)</option>
          </select>
        </div>

        <div className="flex flex-col justify-center">
          <p className="text-sm text-gray-700 dark:text-gray-300">Estimated SDLT</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
            {fmtGBP0(totalDuty)}
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="py-1 pr-3">Band</th>
              <th className="py-1 pr-3">Taxable</th>
              <th className="py-1 pr-3">Rate</th>
              <th className="py-1">Duty</th>
            </tr>
          </thead>
          <tbody>
            {baseline.rows.map((r, i) => (
              <tr key={i} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="py-1 pr-3">{r.label}</td>
                <td className="py-1 pr-3">{fmtGBP0(r.taxable)}</td>
                <td className="py-1 pr-3">{r.ratePct.toFixed(0)}%</td>
                <td className="py-1">{fmtGBP0(Math.round(r.duty))}</td>
              </tr>
            ))}
            {buyerType === 'additional' && (
              <tr className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="py-1 pr-3">Surcharge (+3%)</td>
                <td className="py-1 pr-3">{fmtGBP0(inputPrice)}</td>
                <td className="py-1 pr-3">3%</td>
                <td className="py-1">{fmtGBP0(Math.round(surcharge))}</td>
              </tr>
            )}
            <tr className="border-t border-neutral-300 dark:border-neutral-700 font-semibold">
              <td className="py-1 pr-3">Total</td>
              <td className="py-1 pr-3" />
              <td className="py-1 pr-3" />
              <td className="py-1">{fmtGBP0(totalDuty)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        England & Northern Ireland residential rates. Indicative only — reliefs and surcharges can vary by circumstances.
      </p>
    </div>
  );
}