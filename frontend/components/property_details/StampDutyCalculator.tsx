'use client';
import React, { useEffect, useState } from 'react';
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
    <div className={`card ${className ?? ''}`}>
      <h3 className="text-lg font-semibold mb-4">Stamp Duty Calculator</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="sdlt-price">
            Property Price
          </label>
          <input
            id="sdlt-price"
            type="number"
            inputMode="numeric"
            min={0}
            value={Number.isFinite(inputPrice) ? inputPrice : 0}
            onChange={(e) => setInputPrice(Math.max(0, Number(e.target.value || 0)))}
            className="input-flat"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="sdlt-type">
            Buyer Type
          </label>
          <select
            id="sdlt-type"
            className="input-flat"
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
      <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 mb-4">
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Estimated SDLT</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {formatGBP(calculation.total)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
            Effective rate: {(calculation.effectiveRate * 100).toFixed(2)}%
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-slate-600 dark:text-slate-400">
            {getBuyerTypeLabel(buyerType)}
          </p>
        </div>
      </div>

      {/* Breakdown table with divide-y (no nested borders) */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400">
              <th className="py-2 pr-3 font-medium">Band</th>
              <th className="py-2 pr-3 font-medium">Taxable</th>
              <th className="py-2 pr-3 font-medium">Rate</th>
              <th className="py-2 font-medium">Duty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {calculation.bands.map((band, i) => (
              <tr key={i}>
                <td className="py-2 pr-3">{band.label}</td>
                <td className="py-2 pr-3">{formatGBP(band.taxable)}</td>
                <td className="py-2 pr-3">{band.ratePct.toFixed(0)}%</td>
                <td className="py-2">{formatGBP(Math.round(band.duty))}</td>
              </tr>
            ))}
            {calculation.surcharge > 0 && (
              <tr>
                <td className="py-2 pr-3">Surcharge</td>
                <td className="py-2 pr-3">{formatGBP(inputPrice)}</td>
                <td className="py-2 pr-3">{(calculation.surchargeRate * 100).toFixed(0)}%</td>
                <td className="py-2">{formatGBP(calculation.surcharge)}</td>
              </tr>
            )}
            <tr className="font-semibold border-t-2 border-slate-300 dark:border-slate-700">
              <td className="py-2 pr-3">Total</td>
              <td className="py-2 pr-3" />
              <td className="py-2 pr-3" />
              <td className="py-2">{formatGBP(calculation.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-500 mt-4">
        England & Northern Ireland residential rates. Indicative only — reliefs and surcharges can
        vary by circumstances.
      </p>
    </div>
  );
}
