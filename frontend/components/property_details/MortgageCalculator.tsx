'use client';
import React, { useMemo, useState } from 'react';

interface MortgageCalculatorProps {
  price: number;
}

// helpers
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
const gbp = (n: number, frac = 0) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: frac }).format(
    Number.isFinite(n) ? n : 0
  );

const MortgageCalculator: React.FC<MortgageCalculatorProps> = ({ price }) => {
  // sensible defaults users can tweak
  const [depositPercent, setDepositPercent] = useState(10); // %
  const [interestRate, setInterestRate] = useState(4.5);    // % APR
  const [loanTerm, setLoanTerm] = useState(25);             // years

  // derived figures
  const figures = useMemo(() => {
    const p = Math.max(price || 0, 0);
    const depPct = clamp(depositPercent, 0, 95);
    const ratePct = clamp(interestRate, 0, 99);
    const years = clamp(loanTerm, 1, 40);

    const depositAmount = (depPct / 100) * p;
    const loanAmount = Math.max(p - depositAmount, 0);
    const monthlyRate = ratePct / 100 / 12;
    const months = years * 12;

    let monthlyPayment = 0;
    if (months > 0) {
      if (monthlyRate === 0) {
        monthlyPayment = loanAmount / months;
      } else {
        const pow = Math.pow(1 + monthlyRate, months);
        monthlyPayment = (loanAmount * monthlyRate * pow) / (pow - 1);
      }
    }

    const totalPaid = monthlyPayment * months;
    const totalInterest = Math.max(totalPaid - loanAmount, 0);
    const ltv = p > 0 ? (loanAmount / p) * 100 : 0;

    return { depositAmount, loanAmount, monthlyPayment, totalPaid, totalInterest, ltv, depPct, ratePct, years };
  }, [price, depositPercent, interestRate, loanTerm]);

  return (
    <div className="bg-white dark:bg-neutral-900 shadow-md rounded-md p-5 mt-6">
      <h3 className="text-lg font-semibold mb-4">🧮 Mortgage Calculator</h3>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium">Property Price (£)</label>
          <input
            type="number"
            readOnly
            value={Math.max(price || 0, 0)}
            className="w-full border rounded px-3 py-2 bg-gray-100 dark:bg-neutral-800"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Deposit (%)</label>
          <input
            type="number"
            inputMode="decimal"
            value={depositPercent}
            onChange={(e) => setDepositPercent(Number(e.target.value))}
            onBlur={() => setDepositPercent((v) => clamp(Number(v) || 0, 0, 95))}
            className="w-full border rounded px-3 py-2"
            min={0}
            max={95}
            step="0.5"
          />
          <p className="mt-1 text-xs text-gray-500">Max 95% deposit.</p>
        </div>

        <div>
          <label className="block text-sm font-medium">Interest Rate (APR %)</label>
          <input
            type="number"
            inputMode="decimal"
            value={interestRate}
            onChange={(e) => setInterestRate(Number(e.target.value))}
            onBlur={() => setInterestRate((v) => clamp(Number(v) || 0, 0, 99))}
            className="w-full border rounded px-3 py-2"
            step="0.01"
            min={0}
            max={99}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Loan Term (years)</label>
          <input
            type="number"
            value={loanTerm}
            onChange={(e) => setLoanTerm(Number(e.target.value))}
            onBlur={() => setLoanTerm((v) => clamp(Number(v) || 0, 1, 40))}
            className="w-full border rounded px-3 py-2"
            min={1}
            max={40}
          />
        </div>
      </div>

      {/* Highlighted monthly payment */}
      <div className="bg-blue-50 dark:bg-neutral-800 p-4 rounded text-center">
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">Estimated Monthly Repayment</p>
        <p className="text-2xl font-extrabold text-blue-700 dark:text-blue-400">
          {gbp(figures.monthlyPayment, 0)}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          These figures are estimates and intended as a guide.
        </p>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
        <div className="border rounded p-3 dark:border-neutral-700">
          <div className="flex justify-between"><span>Deposit</span><span>{gbp(figures.depositAmount)}</span></div>
          <div className="flex justify-between mt-1"><span>Loan Amount</span><span>{gbp(figures.loanAmount)}</span></div>
          <div className="flex justify-between mt-1"><span>LTV</span><span>{figures.ltv.toFixed(1)}%</span></div>
        </div>
        <div className="border rounded p-3 dark:border-neutral-700">
          <div className="flex justify-between"><span>Total Repaid</span><span>{gbp(figures.totalPaid)}</span></div>
          <div className="flex justify-between mt-1"><span>Total Interest</span><span>{gbp(figures.totalInterest)}</span></div>
          <div className="flex justify-between mt-1">
            <span>Assumptions</span>
            <span className="text-right">
              {figures.depPct}% dep · {figures.ratePct}% APR · {figures.years}y
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MortgageCalculator;
