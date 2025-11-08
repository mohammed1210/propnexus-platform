// frontend/components/property_details/calculators/BRRRCalculator.tsx
'use client';

import { useState, useEffect } from 'react';
import { calculateBRRR } from '@/lib/investment/formulas';
import type { BRRRInput, BRRROutput } from '@/lib/investment/types';

interface BRRRCalculatorProps {
  initialPrice?: number;
  onChange?: (output: BRRROutput) => void;
  onInputChange?: (input: Partial<BRRRInput>) => void;
  savedInputs?: Partial<BRRRInput>;
}

export default function BRRRCalculator({
  initialPrice,
  onChange,
  onInputChange,
  savedInputs,
}: BRRRCalculatorProps) {
  const [inputs, setInputs] = useState<BRRRInput>({
    purchasePrice: initialPrice ?? savedInputs?.purchasePrice ?? 150000,
    refurbCost: savedInputs?.refurbCost ?? 30000,
    purchaseFees: savedInputs?.purchaseFees ?? 5000,
    arv: savedInputs?.arv ?? 220000,
    refiLtvPercent: savedInputs?.refiLtvPercent ?? 75,
    refiRate: savedInputs?.refiRate ?? 5.25,
    refiTermYears: savedInputs?.refiTermYears ?? 25,
    postRefurbRent: savedInputs?.postRefurbRent ?? 1400,
    monthlyCosts: savedInputs?.monthlyCosts ?? 200,
  });

  const [output, setOutput] = useState<BRRROutput>(() => calculateBRRR(inputs));

  useEffect(() => {
    const result = calculateBRRR(inputs);
    setOutput(result);
    onChange?.(result);
  }, [inputs, onChange]);

  useEffect(() => {
    onInputChange?.(inputs);
  }, [inputs, onInputChange]);

  const handleChange = (field: keyof BRRRInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
    setInputs((prev) => ({ ...prev, [field]: isNaN(value) ? 0 : value }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Inputs */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Inputs
        </h4>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            Purchase Price (£)
          </label>
          <input
            type="number"
            value={inputs.purchasePrice}
            onChange={handleChange('purchasePrice')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100"
            min="0"
            step="1000"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            Refurb Cost (£)
          </label>
          <input
            type="number"
            value={inputs.refurbCost}
            onChange={handleChange('refurbCost')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100"
            min="0"
            step="1000"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            Purchase Fees (£)
          </label>
          <input
            type="number"
            value={inputs.purchaseFees}
            onChange={handleChange('purchaseFees')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100"
            min="0"
            step="100"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            ARV - After Repair Value (£)
          </label>
          <input
            type="number"
            value={inputs.arv}
            onChange={handleChange('arv')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100"
            min="0"
            step="1000"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            Refinance LTV (%)
          </label>
          <input
            type="number"
            value={inputs.refiLtvPercent}
            onChange={handleChange('refiLtvPercent')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100"
            min="0"
            max="100"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            Refinance Rate (%)
          </label>
          <input
            type="number"
            value={inputs.refiRate}
            onChange={handleChange('refiRate')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100"
            min="0"
            step="0.1"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            Post-Refurb Rent (£/mo)
          </label>
          <input
            type="number"
            value={inputs.postRefurbRent}
            onChange={handleChange('postRefurbRent')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100"
            min="0"
            step="50"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            Monthly Costs (£)
          </label>
          <input
            type="number"
            value={inputs.monthlyCosts}
            onChange={handleChange('monthlyCosts')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100"
            min="0"
            step="50"
          />
        </div>
      </div>

      {/* Outputs */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Results
        </h4>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="text-xs text-blue-600 dark:text-blue-400">Total Invested</div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            £{output.totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400">Refi Loan</div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              £{output.refiLoan.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400">Equity Left</div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              £{output.equityAfterRefi.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
          <div className="text-xs text-orange-600 dark:text-orange-400">Cash Left in Deal</div>
          <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
            £{output.cashLeftInDeal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400">Refi Payment / Month</div>
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
            £{output.refiPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="text-xs text-green-600 dark:text-green-400">
            Post-Refurb Cashflow / Month
          </div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">
            £{output.postRefurbCashflow.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <div className="text-xs text-purple-600 dark:text-purple-400">
            ROI (on remaining cash)
          </div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
            {output.roi.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
}
