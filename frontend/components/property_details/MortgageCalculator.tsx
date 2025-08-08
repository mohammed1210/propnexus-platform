'use client';
import React, { useMemo, useState } from 'react';

type Props = { price: number };

// Simple England/Wales stamp duty bands (owner-occupier)
// Add +3% surcharge on each band for additional/BTL
function calcStampDuty(price: number, isAdditional: boolean) {
  // Bands: 0–250k:0%, 250k–925k:5%, 925k–1.5m:10%, >1.5m:12%
  const bands = [
    { upTo: 250_000, rate: 0.00 },
    { upTo: 925_000, rate: 0.05 },
    { upTo: 1_500_000, rate: 0.10 },
    { upTo: Infinity, rate: 0.12 },
  ];
  const surcharge = isAdditional ? 0.03 : 0;
  let remaining = price;
  let prevCap = 0;
  let duty = 0;

  for (const b of bands) {
    const taxable = Math.max(Math.min(remaining, b.upTo - prevCap), 0);
    if (taxable > 0) {
      duty += taxable * (b.rate + surcharge);
      remaining -= taxable;
      prevCap = b.upTo;
    }
    if (remaining <= 0) break;
  }
  return Math.max(Math.round(duty), 0);
}

export default function MortgageCalculator({ price }: Props) {
  // Inputs
  const [depositPct, setDepositPct] = useState(10);
  const [apr, setApr] = useState(4.5);
  const [years, setYears] = useState(25);
  const [interestOnly, setInterestOnly] = useState(false);

  const [stressApr, setStressApr] = useState(6); // stress test APR
  const [monthlyRent, setMonthlyRent] = useState<number | ''>('');

  // Costs
  const [productFee, setProductFee] = useState(999);   // typical lender fee
  const [otherCosts, setOtherCosts] = useState(1500);  // legals, survey, misc
  const [btlSurcharge, setBtlSurcharge] = useState(true);

  // Derived
  const deposit = useMemo(() => (price * depositPct) / 100, [price, depositPct]);
  const loan = useMemo(() => Math.max(price - deposit, 0), [price, deposit]);
  const ltvPct = useMemo(() => (loan / price) * 100 || 0, [loan, price]);

  const monthlyRate = useMemo(() => apr / 100 / 12, [apr]);
  const stressMonthlyRate = useMemo(() => stressApr / 100 / 12, [stressApr]);
  const n = useMemo(() => years * 12, [years]);

  const payment = useMemo(() => {
    if (loan <= 0) return 0;
    if (interestOnly) return loan * monthlyRate;
    if (monthlyRate === 0) return loan / n;
    return (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
  }, [loan, monthlyRate, n, interestOnly]);

  const paymentStress = useMemo(() => {
    if (loan <= 0) return 0;
    if (interestOnly) return loan * stressMonthlyRate;
    if (stressMonthlyRate === 0) return loan / n;
    return (loan * stressMonthlyRate) / (1 - Math.pow(1 + stressMonthlyRate, -n));
  }, [loan, stressMonthlyRate, n, interestOnly]);

  const totalRepaid = useMemo(
    () => (interestOnly ? loan + payment * n : payment * n),
    [payment, n, interestOnly, loan]
  );
  const totalInterest = useMemo(() => Math.max(totalRepaid - loan, 0), [totalRepaid, loan]);

  const duty = useMemo(() => calcStampDuty(price, btlSurcharge), [price, btlSurcharge]);

  // Cash needed = deposit + product fee + other + SDLT
  const cashNeeded = useMemo(() => Math.max(deposit + productFee + otherCosts + duty, 0), [deposit, productFee, otherCosts, duty]);

  // Income & investor KPIs
  const rent = typeof monthlyRent === 'number' ? monthlyRent : 0;
  const cashflow = rent - payment;
  const dscr = payment > 0 ? rent / payment : 0;
  const annualCashflow = cashflow * 12;
  const yieldOnCost = cashNeeded > 0 ? (rent * 12) / cashNeeded : 0;
  const paybackYears = annualCashflow > 0 ? cashNeeded / annualCashflow : Infinity;

  // helpers
  const fmt    = (v: number) => `£${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const fmt2   = (v: number) => `£${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pct    = (v: number) => `${v.toFixed(1)}%`;
  const yearOrNA = (v: number) => (v === Infinity || Number.isNaN(v) ? '—' : `${v.toFixed(1)} yrs`);

  const chip = (p: number) => (
    <button
      key={p}
      type="button"
      onClick={() => setDepositPct(p)}
      className={`px-2 py-1 rounded border text-sm ${depositPct === p ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'}`}
      aria-pressed={depositPct === p}
    >
      {p}%
    </button>
  );

  return (
    <div className="section-box">
      <h3 className="text-xl font-semibold mb-3">🏦 Mortgage Calculator</h3>

      {/* Inputs */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <Field label="Purchase Price">
            <input type="number" value={price} readOnly className="w-40 rounded border border-gray-300 bg-gray-100 px-3 py-2 dark:bg-neutral-800" />
          </Field>

          <Field label={`Deposit (${pct(depositPct)})`}>
            <div className="flex items-center gap-2">
              <input
                type="number" min={0} max={100} step={1}
                value={depositPct} onChange={(e) => setDepositPct(Number(e.target.value))}
                className="w-24 rounded border px-3 py-2"
              />
              <div className="flex flex-wrap gap-1">
                {[10, 15, 20, 25, 40].map(chip)}
              </div>
            </div>
            <div className="text-sm text-slate-500 mt-1">Deposit: <b>{fmt(deposit)}</b></div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Interest Rate (APR)">
              <input type="number" step="0.01" value={apr} onChange={(e) => setApr(Number(e.target.value))} className="w-full rounded border px-3 py-2" />
            </Field>
            <Field label="Loan Term (years)">
              <input type="number" min={1} max={40} value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full rounded border px-3 py-2" />
            </Field>
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={interestOnly} onChange={(e) => setInterestOnly(e.target.checked)} className="h-4 w-4" />
            Interest‑only
          </label>

          <Field label="Stress Test (APR)">
            <div className="flex items-center gap-3">
              <input
                type="range" min={3} max={9} step={0.25}
                value={stressApr} onChange={(e) => setStressApr(Number(e.target.value))}
                className="w-48"
              />
              <input
                type="number" step="0.01"
                value={stressApr} onChange={(e) => setStressApr(Number(e.target.value))}
                className="w-20 rounded border px-2 py-1"
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
          </Field>

          <Field label="Monthly Rent (optional)">
            <input
              type="number" placeholder="e.g. 1,200"
              value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-40 rounded border px-3 py-2"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Product Fee">
              <input type="number" value={productFee} onChange={(e) => setProductFee(Number(e.target.value))} className="w-full rounded border px-3 py-2" />
            </Field>
            <Field label="Other Costs (legals/surveys)">
              <input type="number" value={otherCosts} onChange={(e) => setOtherCosts(Number(e.target.value))} className="w-full rounded border px-3 py-2" />
            </Field>
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={btlSurcharge} onChange={(e) => setBtlSurcharge(e.target.checked)} className="h-4 w-4" />
            Include investor/BTL surcharge (+3% SDLT)
          </label>
        </div>

        {/* Outputs */}
        <div className="space-y-3">
          <KPI label="Loan Amount" value={fmt(loan)} />
          <KPI label="LTV" value={pct(ltvPct)} />
          <KPI label="Monthly Payment" value={fmt2(payment)} highlight />
          <KPI label={`Stress Payment @ ${stressApr.toFixed(2)}%`} value={fmt2(paymentStress)} />

          {!interestOnly && (
            <>
              <KPI label="Total Interest (life of loan)" value={fmt(totalInterest)} />
              <KPI label="Total Repaid" value={fmt(totalRepaid)} />
            </>
          )}

          <KPI label="Stamp Duty (auto)" value={fmt(duty)} />
          <KPI label="Cash Needed (deposit + fees + SDLT)" value={fmt(cashNeeded)} />

          {rent > 0 && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <MiniKPI label="Cash Flow / mo" value={fmt2(cashflow)} positive={cashflow >= 0} />
              <MiniKPI label="Coverage (DSCR)" value={(dscr || 0).toFixed(2) + '×'} positive={dscr >= 1.25} />
              <MiniKPI label="Yield on Cost" value={pct(yieldOnCost * 100)} positive={yieldOnCost >= 0.07} />
              <MiniKPI label="Payback (yrs)" value={yearOrNA(paybackYears)} positive={isFinite(paybackYears) && paybackYears <= 12} />
            </div>
          )}

          <p className="text-xs text-slate-500 mt-3">
            Figures are estimates only. Always verify with your lender/broker.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- tiny presentational helpers ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
    </label>
  );
}

function KPI({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded border px-3 py-2 flex items-center justify-between ${highlight ? 'bg-blue-50 border-blue-200 dark:bg-neutral-800' : 'bg-white dark:bg-neutral-900'}`}>
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`font-semibold ${highlight ? 'text-blue-700 dark:text-blue-400' : ''}`}>{value}</span>
    </div>
  );
}

function MiniKPI({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded border px-3 py-2 text-sm">
      <div className="text-slate-600">{label}</div>
      <div className={`font-semibold ${positive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{value}</div>
    </div>
  );
}
