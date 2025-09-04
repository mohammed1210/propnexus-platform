'use client';
import React, { useMemo, useState } from 'react';

type Props = { price: number };

/* ---------------- Stamp Duty bands (England/Wales, simple) ---------------- */
function calcStampDuty(price: number, isAdditional: boolean) {
  const bands = [
    { upTo: 250_000, rate: 0.0 },
    { upTo: 925_000, rate: 0.05 },
    { upTo: 1_500_000, rate: 0.1 },
    { upTo: Infinity, rate: 0.12 },
  ];
  const surcharge = isAdditional ? 0.03 : 0;
  let remaining = Math.max(price, 0);
  let duty = 0;
  let prevCap = 0;

  for (const b of bands) {
    const taxable = Math.max(Math.min(remaining, b.upTo - prevCap), 0);
    duty += taxable * (b.rate + surcharge);
    remaining -= taxable;
    prevCap = b.upTo;
    if (remaining <= 0) break;
  }
  return Math.round(duty);
}

/* ---------------- Component ---------------- */
export default function MortgageCalculator({ price }: Props) {
  // --- Inputs ---
  const [depositPct, setDepositPct] = useState(25);
  const [apr, setApr] = useState(4.5);
  const [years, setYears] = useState(25);
  const [interestOnly, setInterestOnly] = useState(false);

  const [stressApr, setStressApr] = useState(6);
  const [monthlyRent, setMonthlyRent] = useState<number | ''>('');

  const [productFee, setProductFee] = useState(999);
  const [otherCosts, setOtherCosts] = useState(1500);
  const [btlSurcharge, setBtlSurcharge] = useState(true);

  const [refurbCost, setRefurbCost] = useState(15000);
  const [contingencyPct, setContingencyPct] = useState(10);
  const [monthsOfWorks, setMonthsOfWorks] = useState(3);

  const [arv, setArv] = useState(price);
  const [postRefurbRent, setPostRefurbRent] = useState<number | ''>('');
  const [refiLtvPct, setRefiLtvPct] = useState(75);
  const [refiApr, setRefiApr] = useState(5.25);
  const [refiFees, setRefiFees] = useState(1500);

  // --- Derived ---
  const deposit = useMemo(() => (price * depositPct) / 100, [price, depositPct]);
  const loan = useMemo(() => Math.max(price - deposit, 0), [price, deposit]);
  const ltvPct = useMemo(() => (price > 0 ? (loan / price) * 100 : 0), [loan, price]);

  const monthlyRate = apr / 100 / 12;
  const stressRate = stressApr / 100 / 12;
  const n = years * 12;

  const payment = useMemo(() => {
    if (loan <= 0) return 0;
    if (interestOnly) return loan * monthlyRate;
    return (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
  }, [loan, monthlyRate, n, interestOnly]);

  const stressPayment = useMemo(() => {
    if (loan <= 0) return 0;
    if (interestOnly) return loan * stressRate;
    return (loan * stressRate) / (1 - Math.pow(1 + stressRate, -n));
  }, [loan, stressRate, n, interestOnly]);

  const duty = useMemo(() => calcStampDuty(price, btlSurcharge), [price, btlSurcharge]);
  const contingency = (refurbCost * contingencyPct) / 100;
  const holdingInterest = loan * (apr / 100) * (monthsOfWorks / 12);

  const cashIn = deposit + productFee + otherCosts + duty;
  const projectCost = price + refurbCost + contingency + productFee + otherCosts + duty + holdingInterest;

  const gdvProfit = Math.max(arv - projectCost, 0);
  const profitOnCost = projectCost > 0 ? (gdvProfit / projectCost) * 100 : 0;

  const refiLoan = (arv * refiLtvPct) / 100;
  const refiRate = refiApr / 100 / 12;
  const refiPayment = (refiLoan * refiRate) / (1 - Math.pow(1 + refiRate, -(25 * 12)));
  const equityReleased = Math.max(refiLoan - loan - refiFees, 0);
  const cashLeftIn = Math.max(cashIn + refurbCost + contingency + holdingInterest - equityReleased, 0);

  const rentPre = typeof monthlyRent === 'number' ? monthlyRent : 0;
  const rentPost = typeof postRefurbRent === 'number' ? postRefurbRent : 0;
  const cashflowPre = rentPre - payment;
  const cashflowPost = rentPost - refiPayment;

  // --- Helpers ---
  const fmt = (n: number) => `£${n.toLocaleString()}`;
  const pct = (n: number) => `${n.toFixed(1)}%`;

  return (
    <div className="section-box">
      <h3 className="text-xl font-semibold mb-3">🏦 Mortgage & BRRR Calculator</h3>
      <div className="grid xl:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-6">
          <div className="rounded border p-3">
            <div className="font-semibold mb-2">Purchase</div>
            <label className="block mb-2">
              <span className="block text-sm">Deposit (%)</span>
              <input type="number" value={depositPct} onChange={(e) => setDepositPct(+e.target.value)} className="w-24 border rounded px-2 py-1" />
            </label>
            <p className="text-sm text-slate-500">Deposit: {fmt(deposit)}</p>
          </div>
          {/* add other inputs... */}
        </div>

        {/* Outputs */}
        <div className="space-y-4">
          <div className="rounded border p-3">
            <div className="font-semibold mb-2">Loan Snapshot</div>
            <p>LTV: {pct(ltvPct)}</p>
            <p>Monthly Payment: {fmt(payment)}</p>
            <p>Stress Test: {fmt(stressPayment)}</p>
          </div>
          <div className="rounded border p-3">
            <div className="font-semibold mb-2">Refinance Exit</div>
            <p>Cash Left in Deal: {fmt(cashLeftIn)}</p>
            <p>Post-refurb Cash Flow: {fmt(cashflowPost)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}