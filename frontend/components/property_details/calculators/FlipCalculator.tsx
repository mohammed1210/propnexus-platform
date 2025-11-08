// frontend/components/property_details/calculators/FlipCalculator.tsx
'use client';

import { useState, useEffect } from 'react';
import { calculateFlip } from '@/lib/investment/formulas';
import type { FlipInput, FlipOutput } from '@/lib/investment/types';

interface FlipCalculatorProps {
  initialPrice?: number;
  onChange?: (output: FlipOutput) => void;
  onInputChange?: (input: Partial<FlipInput>) => void;
  savedInputs?: Partial<FlipInput>;
}

export default function FlipCalculator({
  initialPrice,
  onChange,
  onInputChange,
  savedInputs,
}: FlipCalculatorProps) {
  const [inputs, setInputs] = useState<FlipInput>({
    purchasePrice: initialPrice ?? savedInputs?.purchasePrice ?? 180000,
    refurbCost: savedInputs?.refurbCost ?? 40000,
    purchaseFees: savedInputs?.purchaseFees ?? 5000,
    holdingMonths: savedInputs?.holdingMonths ?? 6,
    holdingRate: savedInputs?.holdingRate ?? 5.0,
    targetSalePrice: savedInputs?.targetSalePrice ?? 280000,
    sellingFees: savedInputs?.sellingFees ?? 8000,
  });

  const [output, setOutput] = useState<FlipOutput>(() => calculateFlip(inputs));

  useEffect(() => {
    const result = calculateFlip(inputs);
    setOutput(result);
    onChange?.(result);
  }, [inputs, onChange]);

  useEffect(() => {
    onInputChange?.(inputs);
  }, [inputs, onInputChange]);

  const handleChange = (field: keyof FlipInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
    setInputs((prev) => ({ ...prev, [field]: isNaN(value) ? 0 : value }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Inputs</h4>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Purchase Price (£)</label>
          <input type="number" value={inputs.purchasePrice} onChange={handleChange('purchasePrice')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="1000" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Refurb Cost (£)</label>
          <input type="number" value={inputs.refurbCost} onChange={handleChange('refurbCost')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="1000" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Purchase Fees (£)</label>
          <input type="number" value={inputs.purchaseFees} onChange={handleChange('purchaseFees')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="100" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Holding Months</label>
          <input type="number" value={inputs.holdingMonths} onChange={handleChange('holdingMonths')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="1" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Holding Rate (%)</label>
          <input type="number" value={inputs.holdingRate} onChange={handleChange('holdingRate')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="0.1" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Target Sale Price (£)</label>
          <input type="number" value={inputs.targetSalePrice} onChange={handleChange('targetSalePrice')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="1000" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Selling Fees (£)</label>
          <input type="number" value={inputs.sellingFees} onChange={handleChange('sellingFees')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="100" />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Results</h4>
        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
          <div className="text-xs text-orange-600 dark:text-orange-400">Total Cost</div>
          <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">£{output.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="text-xs text-green-600 dark:text-green-400">Net Profit</div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">£{output.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
            <div className="text-xs text-purple-600 dark:text-purple-400">Profit on Cost</div>
            <div className="text-lg font-bold text-purple-700 dark:text-purple-300">{output.profitOnCost.toFixed(2)}%</div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
            <div className="text-xs text-purple-600 dark:text-purple-400">Annualized ROI</div>
            <div className="text-lg font-bold text-purple-700 dark:text-purple-300">{output.annualizedROI.toFixed(2)}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
