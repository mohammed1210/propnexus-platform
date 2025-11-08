// frontend/components/property_details/calculators/BTLCalculator.tsx
'use client';

import { useState, useEffect } from 'react';
import { calculateBTL } from '@/lib/investment/formulas';
import type { BTLInput, BTLOutput } from '@/lib/investment/types';

interface BTLCalculatorProps {
  initialPrice?: number;
  onChange?: (output: BTLOutput) => void;
  onInputChange?: (input: Partial<BTLInput>) => void;
  savedInputs?: Partial<BTLInput>;
}

export default function BTLCalculator({
  initialPrice,
  onChange,
  onInputChange,
  savedInputs,
}: BTLCalculatorProps) {
  const [inputs, setInputs] = useState<BTLInput>({
    price: initialPrice ?? savedInputs?.price ?? 200000,
    depositPercent: savedInputs?.depositPercent ?? 25,
    interestRate: savedInputs?.interestRate ?? 4.5,
    termYears: savedInputs?.termYears ?? 25,
    monthlyRent: savedInputs?.monthlyRent ?? 1200,
    monthlyCosts: savedInputs?.monthlyCosts ?? 200,
  });

  const [output, setOutput] = useState<BTLOutput>(() => calculateBTL(inputs));

  useEffect(() => {
    const result = calculateBTL(inputs);
    setOutput(result);
    onChange?.(result);
  }, [inputs, onChange]);

  useEffect(() => {
    onInputChange?.(inputs);
  }, [inputs, onInputChange]);

  const handleChange = (field: keyof BTLInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
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
            Property Price (£)
          </label>
          <input
            type="number"
            value={inputs.price}
            onChange={handleChange('price')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100"
            min="0"
            step="1000"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            Deposit (%)
          </label>
          <input
            type="number"
            value={inputs.depositPercent}
            onChange={handleChange('depositPercent')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100"
            min="0"
            max="100"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            Interest Rate (%)
          </label>
          <input
            type="number"
            value={inputs.interestRate}
            onChange={handleChange('interestRate')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100"
            min="0"
            step="0.1"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            Term (Years)
          </label>
          <input
            type="number"
            value={inputs.termYears}
            onChange={handleChange('termYears')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100"
            min="0"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            Monthly Rent (£)
          </label>
          <input
            type="number"
            value={inputs.monthlyRent}
            onChange={handleChange('monthlyRent')}
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
          <div className="text-xs text-blue-600 dark:text-blue-400">Loan Amount</div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            £{output.loanAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400">LTV</div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {output.ltv.toFixed(1)}%
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400">Monthly Payment</div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              £{output.monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
          <div className="text-xs text-orange-600 dark:text-orange-400">Stress Test @6%</div>
          <div className="text-lg font-bold text-orange-700 dark:text-orange-300">
            £{output.stressPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="text-xs text-green-600 dark:text-green-400">Net Cashflow / Month</div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">
            £{output.netCashflow.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
            <div className="text-xs text-purple-600 dark:text-purple-400">Yield</div>
            <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
              {output.annualYield.toFixed(2)}%
            </div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
            <div className="text-xs text-purple-600 dark:text-purple-400">ROI</div>
            <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
              {output.roi.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
