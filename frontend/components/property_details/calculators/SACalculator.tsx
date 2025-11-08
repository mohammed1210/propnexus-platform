// frontend/components/property_details/calculators/SACalculator.tsx
'use client';

import { useState, useEffect } from 'react';
import { calculateSA } from '@/lib/investment/formulas';
import type { SAInput, SAOutput } from '@/lib/investment/types';

interface SACalculatorProps {
  onChange?: (output: SAOutput) => void;
  onInputChange?: (input: Partial<SAInput>) => void;
  savedInputs?: Partial<SAInput>;
}

export default function SACalculator({ onChange, onInputChange, savedInputs }: SACalculatorProps) {
  const [inputs, setInputs] = useState<SAInput>({
    adr: savedInputs?.adr ?? 120,
    occupancyPercent: savedInputs?.occupancyPercent ?? 75,
    nightsPerMonth: savedInputs?.nightsPerMonth ?? 30,
    cleaningFees: savedInputs?.cleaningFees ?? 300,
    channelFees: savedInputs?.channelFees ?? 200,
    monthlyMortgage: savedInputs?.monthlyMortgage ?? 800,
    otherMonthlyCosts: savedInputs?.otherMonthlyCosts ?? 100,
  });

  const [output, setOutput] = useState<SAOutput>(() => calculateSA(inputs));

  useEffect(() => {
    const result = calculateSA(inputs);
    setOutput(result);
    onChange?.(result);
  }, [inputs, onChange]);

  useEffect(() => {
    onInputChange?.(inputs);
  }, [inputs, onInputChange]);

  const handleChange = (field: keyof SAInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
    setInputs((prev) => ({ ...prev, [field]: isNaN(value) ? 0 : value }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Inputs</h4>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Average Daily Rate (£)</label>
          <input type="number" value={inputs.adr} onChange={handleChange('adr')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="10" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Occupancy (%)</label>
          <input type="number" value={inputs.occupancyPercent} onChange={handleChange('occupancyPercent')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" max="100" step="1" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Nights per Month</label>
          <input type="number" value={inputs.nightsPerMonth} onChange={handleChange('nightsPerMonth')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="1" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Cleaning Fees (£/mo)</label>
          <input type="number" value={inputs.cleaningFees} onChange={handleChange('cleaningFees')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="50" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Channel Fees (£/mo)</label>
          <input type="number" value={inputs.channelFees} onChange={handleChange('channelFees')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="50" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Monthly Mortgage (£)</label>
          <input type="number" value={inputs.monthlyMortgage} onChange={handleChange('monthlyMortgage')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="50" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Other Costs (£/mo)</label>
          <input type="number" value={inputs.otherMonthlyCosts} onChange={handleChange('otherMonthlyCosts')} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" min="0" step="50" />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Results</h4>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="text-xs text-blue-600 dark:text-blue-400">Gross Monthly Revenue</div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">£{output.grossMonthlyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400">Net Monthly Revenue</div>
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">£{output.netMonthlyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="text-xs text-green-600 dark:text-green-400">Net Cashflow / Month</div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">£{output.netCashflow.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <div className="text-xs text-purple-600 dark:text-purple-400">Annual NOI</div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">£{output.annualNOI.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
      </div>
    </div>
  );
}
