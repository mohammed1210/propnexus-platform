'use client';

import React, { useMemo, useState } from 'react';

type Props = { price: number };

/* SDLT (England/NI simple) */
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
  let prev = 0;
  for (const b of bands) {
    const taxable = Math.max(Math.min(remaining, b.upTo - prev), 0);
    duty += taxable * (b.rate + surcharge);
    remaining -= taxable;
    prev = b.upTo;
    if (remaining <= 0) break;
  }
  return Math.round(duty);
}

export default function MortgageCalculator({ price }: Props) {
  // Purchase / loan
  const [depositPct, setDepositPct] = useState(25);
  const [apr, setApr] = useState(4.5);
  const [years, setYears] = useState(25);
  const [interestOnly, setInterestOnly] = useState(false);

  // Stress + rents
  const [stressApr, setStressApr] = useState(6);
  const [monthlyRent, setMonthlyRent] = useState<number | ''>('');

  // Upfront costs
  const [productFee, setProductFee] = useState(999);
  const [otherCosts, setOtherCosts] = useState(1500);
  const [btlSurcharge, setBtlSurcharge] = useState(true);

  // Works
  const [refurbCost, setRefurbCost] = useState(15000);
  const [contingencyPct, setContingencyPct] = useState(10);
  const [monthsOfWorks, setMonthsOfWorks] = useState(3);

  // BRRR refi
  const [arv, setArv] = useState(price);
  const [postRefurbRent, setPostRefurbRent] = useState<number | ''>('');
  const [refiLtvPct, setRefiLtvPct] = useState(75);
  const [refiApr, setRefiApr] = useState(5.25);
  const [refiFees, setRefiFees] = useState(1500);

  // Derived
  const deposit = useMemo(() => (price * depositPct) / 100, [price, depositPct]);
  const loan = useMemo(() => Math.max(price - deposit, 0), [price, deposit]);
  const ltvPct = useMemo(() => (price > 0 ? (loan / price) * 100 : 0), [loan, price]);

  const mRate = apr / 100 / 12;
  const sRate = stressApr / 100 / 12;
  const n = years * 12;

  const payment = useMemo(() => {
    if (loan <= 0) return 0;
    if (interestOnly) return loan * mRate;
    return (loan * mRate) / (1 - Math.pow(1 + mRate, -n));
  }, [loan, mRate, n, interestOnly]);

  const stressPayment = useMemo(() => {
    if (loan <= 0) return 0;
    if (interestOnly) return loan * sRate;
    return (loan * sRate) / (1 - Math.pow(1 + sRate, -n));
  }, [loan, sRate, n, interestOnly]);

  const duty = useMemo(() => calcStampDuty(price, btlSurcharge), [price, btlSurcharge]);
  const contingency = (refurbCost * contingencyPct) / 100;
  const holdingInterest = loan * (apr / 100) * (monthsOfWorks / 12);

  const cashInAtPurchase = deposit + productFee + otherCosts + duty;
  const projectCost =
    price + refurbCost + contingency + productFee + otherCosts + duty + holdingInterest;

  // GDV sale
  const gdvProfit = arv - projectCost;
  const profitOnCost = projectCost > 0 ? (gdvProfit / projectCost) * 100 : 0;

  // Refi
  const refiLoan = (arv * refiLtvPct) / 100;
  const refiRate = refiApr / 100 / 12;
  const refiPayment = (refiLoan * refiRate) / (1 - Math.pow(1 + refiRate, -(25 * 12)));
  const equityReleased = Math.max(refiLoan - loan - refiFees, 0);
  const cashLeftIn =
    Math.max(cashInAtPurchase + refurbCost + contingency + holdingInterest - equityReleased, 0);

  // Cash flows
  const rentPre = typeof monthlyRent === 'number' ? monthlyRent : 0;
  const rentPost = typeof postRefurbRent === 'number' ? postRefurbRent : 0;
  const cashflowPre = rentPre - payment;
  const cashflowPost = rentPost - refiPayment;

  const fmt = (n: number) => `£${Math.round(n).toLocaleString()}`;
  const pct = (n: number) => `${n.toFixed(1)}%`;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <h3 className="text-lg font-semibold mb-3">🏦 Mortgage & BRRR Calculator</h3>

      <div className="grid xl:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-4">
          <div className="rounded-md border border-slate-200 dark:border-slate-800 p-3">
            <div className="font-medium mb-2">Purchase</div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Deposit (%)</span>
                <input
                  type="number"
                  value={depositPct}
                  onChange={(e) => setDepositPct(+e.target.value || 0)}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <div className="text-sm text-slate-600">Deposit: <strong>{fmt(deposit)}</strong></div>

              <label className="text-sm">
                <span className="block text-slate-600 mb-1">APR (%)</span>
                <input
                  type="number"
                  step="0.01"
                  value={apr}
                  onChange={(e) => setApr(+e.target.value || 0)}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Term (years)</span>
                <input
                  type="number"
                  value={years}
                  onChange={(e) => setYears(+e.target.value || 0)}
                  className="w-full h-9 rounded border px-2"
                />
              </label>

              <label className="col-span-2 inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={interestOnly}
                  onChange={(e) => setInterestOnly(e.target.checked)}
                />
                Interest-only
              </label>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 dark:border-slate-800 p-3">
            <div className="font-medium mb-2">Costs</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Product Fee</span>
                <input
                  type="number"
                  value={productFee}
                  onChange={(e) => setProductFee(+e.target.value || 0)}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Other Costs</span>
                <input
                  type="number"
                  value={otherCosts}
                  onChange={(e) => setOtherCosts(+e.target.value || 0)}
                  className="w-full h-9 rounded border px-2"
                />
              </label>

              <label className="col-span-2 inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={btlSurcharge}
                  onChange={(e) => setBtlSurcharge(e.target.checked)}
                />
                Include investor/BTL surcharge (+3% SDLT)
              </label>

              <div className="col-span-2 text-sm text-slate-600">
                Estimated SDLT: <strong>{fmt(duty)}</strong>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 dark:border-slate-800 p-3">
            <div className="font-medium mb-2">Works</div>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-sm col-span-1">
                <span className="block text-slate-600 mb-1">Works (£)</span>
                <input
                  type="number"
                  value={refurbCost}
                  onChange={(e) => setRefurbCost(+e.target.value || 0)}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <label className="text-sm col-span-1">
                <span className="block text-slate-600 mb-1">Contingency (%)</span>
                <input
                  type="number"
                  value={contingencyPct}
                  onChange={(e) => setContingencyPct(+e.target.value || 0)}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <label className="text-sm col-span-1">
                <span className="block text-slate-600 mb-1">Months of Works</span>
                <input
                  type="number"
                  value={monthsOfWorks}
                  onChange={(e) => setMonthsOfWorks(+e.target.value || 0)}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 dark:border-slate-800 p-3">
            <div className="font-medium mb-2">Stress & Rent</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Stress APR (%)</span>
                <input
                  type="number"
                  step="0.01"
                  value={stressApr}
                  onChange={(e) => setStressApr(+e.target.value || 0)}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Monthly Rent (pre)</span>
                <input
                  type="number"
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(e.target.value ? +e.target.value : '')}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 dark:border-slate-800 p-3">
            <div className="font-medium mb-2">Refinance (BRRR)</div>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-sm col-span-1">
                <span className="block text-slate-600 mb-1">ARV (£)</span>
                <input
                  type="number"
                  value={arv}
                  onChange={(e) => setArv(+e.target.value || 0)}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <label className="text-sm col-span-1">
                <span className="block text-slate-600 mb-1">Refi LTV (%)</span>
                <input
                  type="number"
                  value={refiLtvPct}
                  onChange={(e) => setRefiLtvPct(+e.target.value || 0)}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <label className="text-sm col-span-1">
                <span className="block text-slate-600 mb-1">Refi APR (%)</span>
                <input
                  type="number"
                  step="0.01"
                  value={refiApr}
                  onChange={(e) => setRefiApr(+e.target.value || 0)}
                  className="w-full h-9 rounded border px-2"
                />
              </label>

              <label className="text-sm col-span-1">
                <span className="block text-slate-600 mb-1">Refi Fees (£)</span>
                <input
                  type="number"
                  value={refiFees}
                  onChange={(e) => setRefiFees(+e.target.value || 0)}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <label className="text-sm col-span-2">
                <span className="block text-slate-600 mb-1">Monthly Rent (post)</span>
                <input
                  type="number"
                  value={postRefurbRent}
                  onChange={(e) => setPostRefurbRent(e.target.value ? +e.target.value : '')}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Outputs */}
        <div className="space-y-4">
          <div className="rounded-md border border-slate-200 dark:border-slate-800 p-3">
            <div className="font-medium mb-2">Loan Snapshot</div>
            <p>LTV: <strong>{pct(ltvPct)}</strong></p>
            <p>Monthly Payment: <strong>{fmt(payment)}</strong></p>
            <p>Stress Payment @ {stressApr.toFixed(2)}%: <strong>{fmt(stressPayment)}</strong></p>
          </div>

          <div className="rounded-md border border-slate-200 dark:border-slate-800 p-3">
            <div className="font-medium mb-2">Costs & Cash Needed</div>
            <p>Stamp Duty (auto): <strong>{fmt(duty)}</strong></p>
            <p>Holding Interest (works period): <strong>{fmt(holdingInterest)}</strong></p>
            <p>Project Cost (all-in): <strong>{fmt(projectCost)}</strong></p>
            <p>Cash In at Purchase: <strong>{fmt(cashInAtPurchase)}</strong></p>
          </div>

          <div className="rounded-md border border-slate-200 dark:border-slate-800 p-3">
            <div className="font-medium mb-2">Sale Exit (GDV)</div>
            <p>GDV Profit (ARV − project cost): <strong>{fmt(gdvProfit)}</strong></p>
            <p>Profit on Cost: <strong>{pct(profitOnCost)}</strong></p>
          </div>

          <div className="rounded-md border border-slate-200 dark:border-slate-800 p-3">
            <div className="font-medium mb-2">Refinance Exit (BRRR)</div>
            <p>Refi Loan (LTV × ARV): <strong>{fmt(refiLoan)}</strong></p>
            <p>Equity Released (refi − old loan − fees): <strong>{fmt(equityReleased)}</strong></p>
            <p>Cash Left in Deal: <strong>{fmt(cashLeftIn)}</strong></p>
            <p>New Monthly Payment (post-refi): <strong>{fmt(refiPayment)}</strong></p>
            <p>Post-refurb Cash Flow: <strong>{fmt(cashflowPost)}</strong></p>
          </div>

          <div className="rounded-md border border-slate-200 dark:border-slate-800 p-3">
            <div className="font-medium mb-2">Cash Flow (Current)</div>
            <p>Monthly Rent: <strong>{fmt(rentPre)}</strong></p>
            <p>Cash Flow (pre-refurb): <strong>{fmt(cashflowPre)}</strong></p>
          </div>

          <p className="text-xs text-slate-500">
            This is an illustrative model; stress tests, bridging interest accruals and fees are approximated.
          </p>
        </div>
      </div>
    </div>
  );
}