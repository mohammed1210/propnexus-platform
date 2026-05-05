'use client';
import React, { useEffect, useState } from 'react';
import { FiCreditCard, FiShield } from 'react-icons/fi';
import { calculateSDLT, formatGBP, getBuyerTypeLabel, type BuyerType } from '@/lib/finance/sdlt';

interface StampDutyCalculatorProps {
  /** Seed price; user can still edit locally */
  price: number;
  className?: string;
}

export default function StampDutyCalculator({ price, className }: StampDutyCalculatorProps) {
  const [buyerType, setBuyerType] = useState<BuyerType>('standard');
  const [inputPrice, setInputPrice] = useState<number>(price);

  // Keep local input synced to prop changes
  useEffect(() => setInputPrice(price), [price]);

  // Calculate SDLT using our library
  const calculation = calculateSDLT(inputPrice, buyerType);

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 md:p-5 ${className ?? ''}`}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
            <FiCreditCard className="h-3.5 w-3.5" aria-hidden="true" />
            Acquisition costs
          </div>
          <h3 className="mt-3 text-xl font-black tracking-tight text-slate-950 dark:text-white">
            Stamp Duty
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Estimate SDLT alongside your return assumptions.
          </p>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
          <FiShield className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="sdlt-price">
            Property Price
          </label>
          <input
            id="sdlt-price"
            type="number"
            inputMode="numeric"
            min={0}
            value={Number.isFinite(inputPrice) ? inputPrice : 0}
            onChange={(e) => setInputPrice(Math.max(0, Number(e.target.value || 0)))}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-950 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="sdlt-type">
            Buyer Type
          </label>
          <select
            id="sdlt-type"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-950 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={buyerType}
            onChange={(e) => setBuyerType(e.target.value as BuyerType)}
          >
            <option value="standard">Standard residential</option>
            <option value="additional">Additional property (+3%)</option>
            <option value="nonresident">Non-resident (+2%)</option>
            <option value="additional_nonresident">Additional + Non-resident (+5%)</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
            Estimated SDLT
          </p>
          <p className="mt-1 text-3xl font-black tracking-tight text-emerald-700 dark:text-emerald-300">
            {formatGBP(calculation.total)}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">
            Effective rate: {(calculation.effectiveRate * 100).toFixed(2)}%
          </p>
        </div>
        <div className="mt-3 inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm dark:bg-slate-900/80 dark:text-slate-300">
          {getBuyerTypeLabel(buyerType)}
        </div>
      </div>

      {/* Breakdown table with divide-y (no nested borders) */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-bold">Band</th>
              <th className="px-3 py-2 font-bold">Taxable</th>
              <th className="px-3 py-2 font-bold">Rate</th>
              <th className="px-3 py-2 font-bold">Duty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700 dark:divide-slate-800 dark:text-slate-300">
            {calculation.bands.map((band, i) => (
              <tr key={i}>
                <td className="px-3 py-2">{band.label}</td>
                <td className="px-3 py-2">{formatGBP(band.taxable)}</td>
                <td className="px-3 py-2">{band.ratePct.toFixed(0)}%</td>
                <td className="px-3 py-2 font-semibold">{formatGBP(Math.round(band.duty))}</td>
              </tr>
            ))}
            {calculation.surcharge > 0 && (
              <tr>
                <td className="px-3 py-2">Surcharge</td>
                <td className="px-3 py-2">{formatGBP(inputPrice)}</td>
                <td className="px-3 py-2">{(calculation.surchargeRate * 100).toFixed(0)}%</td>
                <td className="px-3 py-2 font-semibold">{formatGBP(calculation.surcharge)}</td>
              </tr>
            )}
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
              <td className="px-3 py-2">{formatGBP(calculation.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-500">
        England & Northern Ireland residential rates. Indicative only — reliefs and surcharges can
        vary by circumstances.
      </p>
    </div>
  );
}
