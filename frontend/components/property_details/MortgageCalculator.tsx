'use client';
import React, { useMemo, useState } from 'react';

type Props = { price: number };

export default function MortgageCalculator({ price }: Props) {
  // Inputs
  const [depositPct, setDepositPct] = useState(10);      // %
  const [apr, setApr] = useState(4.5);                   // annual %
  const [years, setYears] = useState(25);                // years
  const [interestOnly, setInterestOnly] = useState(false);
  const [monthlyRent, setMonthlyRent] = useState<number | ''>(''); // optional

  // Derived
  const deposit = useMemo(() => (price * depositPct) / 100, [price, depositPct]);
  const loan = useMemo(() => Math.max(price - deposit, 0), [price, deposit]);
  const ltvPct = useMemo(() => (loan / price) * 100 || 0, [loan, price]);

  const monthlyRate = useMemo(() => apr / 100 / 12, [apr]);
  const n = useMemo(() => years * 12, [years]);

  const monthlyPayment = useMemo(() => {
    if (loan <= 0) return 0;
    if (interestOnly) return loan * monthlyRate; // IO = interest only
    if (monthlyRate === 0) return loan / n;
    return (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
  }, [loan, monthlyRate, n, interestOnly]);

  // Totals (for repayment only – IO has no capital paydown)
  const totalRepaid = useMemo(() => (interestOnly ? loan + monthlyPayment * n : monthlyPayment * n), [monthlyPayment, n, interestOnly, loan]);
  const totalInterest = useMemo(() => Math.max(totalRepaid - loan, 0), [totalRepaid, loan]);

  // Income side (optional)
  const rent = typeof monthlyRent === 'number' ? monthlyRent : 0;
  const cashflow = rent - monthlyPayment;
  const dscr = monthlyPayment > 0 ? rent / monthlyPayment : 0;

  // helpers
  const fmt = (v: number) => `£${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const fmt2 = (v: number) => `£${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pct = (v: number) => `${v.toFixed(1)}%`;

  const quickSet = (p: number) => setDepositPct(p);

  return (
    <div className="section-box">
      <h3 className="text-xl font-semibold mb-3">🏦 Mortgage Calculator</h3>

      {/* Inputs */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Field label="Purchase Price">
            <input
              type="number"
              value={price}
              readOnly
              className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 dark:bg-neutral-800"
            />
          </Field>

          <Field label={`Deposit (${pct(depositPct)})`}>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={depositPct}
                onChange={(e) => setDepositPct(Number(e.target.value))}
                className="w-28 rounded border px-3 py-2"
              />
              <div className="flex flex-wrap gap-1">
                {[10, 15, 20, 25, 40].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => quickSet(p)}
                    className={`px-2 py-1 rounded border text-sm ${depositPct === p ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'}`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <div className="text-sm text-slate-500 mt-1">Deposit: <b>{fmt(deposit)}</b></div>
          </Field>

          <Field label="Interest Rate (APR)">
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                value={apr}
                onChange={(e) => setApr(Number(e.target.value))}
                className="w-28 rounded border px-3 py-2"
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
          </Field>

          <Field label="Loan Term (years)">
            <input
              type="number"
              min={1}
              max={40}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="w-28 rounded border px-3 py-2"
            />
          </Field>

          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={interestOnly}
              onChange={(e) => setInterestOnly(e.target.checked)}
              className="h-4 w-4"
            />
            Interest‑only
          </label>

          <Field label="Monthly Rent (optional)">
            <input
              type="number"
              placeholder="e.g. 1,200"
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-40 rounded border px-3 py-2"
            />
          </Field>
        </div>

        {/* Outputs */}
        <div className="space-y-3">
          <KPI label="Loan Amount" value={fmt(loan)} />
          <KPI label="LTV" value={pct(ltvPct)} />
          <KPI label="Monthly Payment" value={fmt2(monthlyPayment)} highlight />

          {!interestOnly && (
            <>
              <KPI label="Total Interest (life of loan)" value={fmt(totalInterest)} />
              <KPI label="Total Repaid" value={fmt(totalRepaid)} />
            </>
          )}

          {rent > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniKPI label="Cash Flow / mo" value={fmt2(cashflow)} positive={cashflow >= 0} />
              <MiniKPI label="Coverage (DSCR)" value={dscr.toFixed(2) + '×'} positive={dscr >= 1.25} />
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
    </label>
  );
}

function KPI({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded border px-3 py-2 flex items-center justify-between ${
        highlight ? 'bg-blue-50 border-blue-200 dark:bg-neutral-800' : 'bg-white dark:bg-neutral-900'
      }`}
    >
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`font-semibold ${highlight ? 'text-blue-700 dark:text-blue-400' : ''}`}>{value}</span>
    </div>
  );
}

function MiniKPI({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded border px-3 py-2 text-sm">
      <div className="text-slate-600">{label}</div>
      <div className={`font-semibold ${positive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
        {value}
      </div>
    </div>
  );
}
