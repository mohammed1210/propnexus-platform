'use client';
import React, { useEffect, useState } from 'react';

interface StampDutyCalculatorProps {
  price: number;
}

const StampDutyCalculator: React.FC<StampDutyCalculatorProps> = ({ price }) => {
  const [stampDuty, setStampDuty] = useState(0);

  useEffect(() => {
    const calculateStampDuty = (price: number): number => {
      if (price <= 250000) return 0;
      let duty = 0;
      if (price > 250000) duty += Math.min(price - 250000, 675000) * 0.05;
      if (price > 925000) duty += Math.min(price - 925000, 575000) * 0.10;
      if (price > 1500000) duty += (price - 1500000) * 0.12;
      return duty;
    };

    setStampDuty(calculateStampDuty(price));
  }, [price]);

  return (
    <div className="bg-white dark:bg-neutral-900 shadow-md rounded-md p-5 mt-6">
      <h3 className="text-lg font-semibold mb-4">🏛️ Stamp Duty Calculator</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Property Price (£)</label>
          <input
            type="number"
            value={price}
            readOnly
            className="w-full border rounded px-3 py-2 bg-gray-100 dark:bg-neutral-800"
          />
        </div>

        <div className="flex flex-col justify-center">
          <p className="text-sm text-gray-700 dark:text-gray-300">Estimated Stamp Duty:</p>
          <p className="text-xl font-bold text-green-700 dark:text-green-400 mt-1">
            £{stampDuty.toFixed(2)}
          </p>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Based on standard residential rates in England (no first-time buyer relief or surcharges).
      </p>
    </div>
  );
};

export default StampDutyCalculator;
