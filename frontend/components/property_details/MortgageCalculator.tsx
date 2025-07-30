'use client';
import React, { useState, useEffect } from 'react';

interface MortgageCalculatorProps {
  price: number;
}

const MortgageCalculator: React.FC<MortgageCalculatorProps> = ({ price }) => {
  const [depositPercent, setDepositPercent] = useState(10);
  const [interestRate, setInterestRate] = useState(4.5);
  const [loanTerm, setLoanTerm] = useState(25);
  const [monthlyPayment, setMonthlyPayment] = useState(0);

  useEffect(() => {
    const depositAmount = (depositPercent / 100) * price;
    const loanAmount = price - depositAmount;
    const monthlyInterest = interestRate / 100 / 12;
    const numberOfPayments = loanTerm * 12;

    if (monthlyInterest === 0) {
      setMonthlyPayment(loanAmount / numberOfPayments);
    } else {
      const payment =
        (loanAmount * monthlyInterest) /
        (1 - Math.pow(1 + monthlyInterest, -numberOfPayments));
      setMonthlyPayment(payment);
    }
  }, [price, depositPercent, interestRate, loanTerm]);

  return (
    <div className="bg-white dark:bg-neutral-900 shadow-md rounded-md p-5 mt-6">
      <h3 className="text-lg font-semibold mb-4">🧮 Mortgage Calculator</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium">Property Price (£)</label>
          <input
            type="number"
            value={price}
            readOnly
            className="w-full border rounded px-3 py-2 bg-gray-100 dark:bg-neutral-800"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Deposit (%)</label>
          <input
            type="number"
            value={depositPercent}
            onChange={(e) => setDepositPercent(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
            min={0}
            max={100}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Interest Rate (%)</label>
          <input
            type="number"
            value={interestRate}
            onChange={(e) => setInterestRate(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
            step="0.01"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Loan Term (years)</label>
          <input
            type="number"
            value={loanTerm}
            onChange={(e) => setLoanTerm(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
            min={1}
            max={40}
          />
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-neutral-800 p-4 rounded mt-4 text-center">
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">Estimated Monthly Repayment:</p>
        <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
          £{monthlyPayment.toFixed(2)}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          These figures are estimates and intended as a guide.
        </p>
      </div>
    </div>
  );
};

export default MortgageCalculator;
