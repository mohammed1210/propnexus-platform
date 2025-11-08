// frontend/components/property_details/calculators/HMOCalculator.tsx
'use client';

import { useState, useEffect } from 'react';
import { calculateHMO } from '@/lib/investment/formulas';
import type { HMOInput, HMOOutput } from '@/lib/investment/types';

interface HMOCalculatorProps {
  onChange?: (output: HMOOutput) => void;
  onInputChange?: (input: Partial<HMOInput>) => void;
  savedInputs?: Partial<HMOInput>;
}

export default function HMOCalculator({ onChange, onInputChange, savedInputs }: HMOCalculatorProps) {
  const [inputs, setInputs] = useState<HMOInput>({
    rooms: savedInputs?.rooms ?? 5,
    rentPerRoom: savedInputs?.rentPerRoom ?? 500,
    voidPercent: savedInputs?.voidPercent ?? 10,
    monthlyBills: savedInputs?.monthlyBills ?? 300,
    monthlyMortgage: savedInputs?.monthlyMortgage ?? 800,
    otherMonthlyCosts: savedInputs?.otherMonthlyCosts ?? 150,
    totalInvestment: savedInputs?.totalInvestment ?? 50000,
  });

  const [output, setOutput] = useState<HMOOutput>(() => calculateHMO(inputs));

  useEffect(() => {
    const result = calculateHMO(inputs);
    setOutput(result);
    onChange?.(result);
  }, [inputs, onChange]);

  useEffect(() => {
    onInputChange?.(inputs);
  }, [inputs, onInputChange]);

  const handleChange = (field: keyof HMOInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
    setInputs((prev) => ({ ...prev, [field]: isNaN(value) ? 0 : value }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Inputs</h4>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Number of Rooms</label>
          <input type="number" value={inputs.rooms} onChange={handleChange('rooms')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="1" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Rent per Room (£/mo)</label>
          <input type="number" value={inputs.rentPerRoom} onChange={handleChange('rentPerRoom')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="50" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Void (%)</label>
          <input type="number" value={inputs.voidPercent} onChange={handleChange('voidPercent')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" max="100" step="1" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Monthly Bills (£)</label>
          <input type="number" value={inputs.monthlyBills} onChange={handleChange('monthlyBills')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="50" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Monthly Mortgage (£)</label>
          <input type="number" value={inputs.monthlyMortgage} onChange={handleChange('monthlyMortgage')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="50" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Other Costs (£/mo)</label>
          <input type="number" value={inputs.otherMonthlyCosts} onChange={handleChange('otherMonthlyCosts')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="50" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Total Investment (£)</label>
          <input type="number" value={inputs.totalInvestment ?? 0} onChange={handleChange('totalInvestment')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="1000" />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Results</h4>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="text-xs text-blue-600 dark:text-blue-400">Gross Monthly Rent</div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">£{output.grossMonthlyRent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400">Effective Rent (after void)</div>
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">£{output.effectiveRent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="text-xs text-green-600 dark:text-green-400">Net Cashflow / Month</div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">£{output.netCashflow.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
            <div className="text-xs text-purple-600 dark:text-purple-400">Annual Yield</div>
            <div className="text-lg font-bold text-purple-700 dark:text-purple-300">£{output.annualYield.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
            <div className="text-xs text-purple-600 dark:text-purple-400">ROI</div>
            <div className="text-lg font-bold text-purple-700 dark:text-purple-300">{output.roi.toFixed(2)}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
