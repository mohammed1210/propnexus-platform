'use client';
import React, { useEffect, useMemo, useState } from 'react';

type Props = { price: number };

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});
const gbp2 = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 2,
});

export default function MortgageCalculator({ price }: Props) {
  // Inputs
  const [repaymentType, setRepaymentType] = useState<'repayment' | 'interestOnly'>('repayment');
  const [depositPct, setDepositPct] = useState<number>(25);
  const [rate, setRate] = useState<number>(4.5);       // APR %
  const [termYears, setTermYears] = useState<number>(25);
  const [monthlyRent, setMonthlyRent] = useState<number | ''>(''); // optional

  // Derived
  const depositAmt = useMemo(() => (price * (depositPct / 100)), [price, depositPct]);
  const loanAmt = useMemo(() => Math.max(0, price - depositAmt), [price, depositAmt]);
  const ltv = useMemo(() => (loanAmt / price) * 100, [loanAmt, price]);

  const monthlyRate = useMemo(() => rate / 100 / 12, [rate]);
  const n = useMemo(() => termYears * 12, [termYears]);

  // Monthly payment
  const monthlyPayment = useMemo(() => {
    if (repaymentType === 'interestOnly') {
      return loanAmt * monthlyRate; // if rate is 0 -> £0 interest
    }
    if (monthlyRate === 0) return loanAmt / n;
    return (loanAmt * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
  }, [repaymentType, loanAmt, monthlyRate, n]);

  // Totals (repayment only)
  const totalRepaid = useMemo(() => {
    if (repaymentType === 'interestOnly') return monthlyPayment * n; // interest paid over term (principal not repaid)
    return monthlyPayment * n;
  }, [repaymentType, monthlyPayment, n]);

  const totalInterest = useMemo(() => {
    if (repaymentType === 'interestOnly') return monthlyPayment * n; // all interest, principal not included
    return totalRepaid - loanAmt;
  }, [repaymentType, monthlyPayment, n, totalRepaid, loanAmt]);

  // Cash flow / coverage (if rent provided)
  const cashflow = useMemo(() => {
    if (monthlyRent === '' || monthlyRent == null) return null;
    return (monthlyRent as number) - monthlyPayment;
  }, [monthlyRent, monthlyPayment]);

  const coverage = useMemo(() => {
    if (monthlyRent === '' || monthlyRent == null || monthlyPayment === 0) return null;
    return (monthlyRent as number) / monthlyPayment;
  }, [monthlyRent, monthlyPayment]);

  // Helpers
  const presetDeposits = [10, 15, 20, 25, 30, 40];

  return (
    <section className="section-box">
      <h3 className="text-xl font-semibold mb-3">🏦 Mortgage Calculator</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LEFT: inputs */}
        <div>
          <div className="text-sm text-slate-500 mb-2">Property Price</div>
          <div className="mb-4">
            <input
              value={price}
              readOnly
              className="w-full rounded border border-slate-300 bg-slate-100 px-3 py-2 dark:bg-neutral-800"
            />
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">Deposit (%)</label>
              <div className="flex gap-1">
                {presetDeposits.map((p) => (
                  <button
                    key={p}
                    onClick={() => setDepositPct(p)}
                    className={`text-xs px-2 py-1 rounded border ${
                      depositPct === p
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-300 hover:bg-slate-100'
                    }`}
                    type="button"
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              min={0}
              max={95}
              step={1}
              value={depositPct}
              onChange={(e) => setDepositPct(Number(e.target.value))}
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
            <p className="text-xs text-slate-500 mt-1">Max 95% deposit.</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Interest Rate (APR %)</label>
            <input
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Loan Term (years)</label>
            <input
              type="number"
              min={1}
              max={40}
              step={1}
              value={termYears}
              onChange={(e) => setTermYears(Number(e.target.value))}
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="mb-4">
            <span className="block text-sm font-medium mb-1">Repayment Type</span>
            <div className="inline-flex rounded border border-slate-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setRepaymentType('repayment')}
                className={`px-3 py-2 text-sm ${
                  repaymentType === 'repayment' ? 'bg-blue-600 text-white' : 'bg-white'
                }`}
              >
                Repayment
              </button>
              <button
                type="button"
                onClick={() => setRepaymentType('interestOnly')}
                className={`px-3 py-2 text-sm border-l border-slate-300 ${
                  repaymentType === 'interestOnly' ? 'bg-blue-600 text-white' : 'bg-white'
                }`}
              >
                Interest‑only
              </button>
            </div>
          </div>

          <details className="mt-2">
            <summary className="text-sm cursor-pointer select-none text-slate-600">
              Advanced (optional): monthly rent
            </summary>
            <div className="mt-2">
              <label className="block text-sm font-medium mb-1">Monthly Rent (£)</label>
              <input
                type="number"
                min={0}
                value={monthlyRent === '' ? '' : monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded border border-slate-300 px-3 py-2"
              />
            </div>
          </details>
        </div>

        {/* RIGHT: outputs */}
        <div className="rounded-md border border-slate-200 p-4 bg-slate-50 dark:bg-neutral-900">
          <div className="text-sm text-slate-600 mb-1">Key Numbers</div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <Stat label="Deposit" value={gbp.format(Math.round(depositAmt))} />
            <Stat label="Loan Amount" value={gbp.format(Math.round(loanAmt))} />
            <Stat label="LTV" value={`${ltv.toFixed(1)}%`} />
            <Stat label="APR" value={`${rate.toFixed(2)}%`} />
          </div>

          <div className="rounded bg-white dark:bg-neutral-800 border border-slate-200 p-4 mb-3">
            <div className="text-sm text-slate-600">Estimated Monthly Repayment</div>
            <div className="text-2xl font-semibold">
              {gbp2.format(isFinite(monthlyPayment) ? monthlyPayment : 0)}
            </div>
            {repaymentType === 'interestOnly' ? (
              <p className="text-xs text-slate-500 mt-1">
                Interest‑only: payment is interest only; principal not repaid during term.
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-1">
                Capital‑and‑interest repayment over {termYears} years.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <Stat
              label={repaymentType === 'interestOnly' ? 'Interest over term' : 'Total Repaid'}
              value={gbp.format(Math.round(totalRepaid))}
            />
            <Stat label="Total Interest" value={gbp.format(Math.round(totalInterest))} />
          </div>

          {monthlyRent !== '' && (
            <div className="rounded bg-white dark:bg-neutral-800 border border-slate-200 p-3">
              <div className="text-sm text-slate-600 mb-1">Rent & Cash Flow</div>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Monthly Rent" value={gbp2.format(monthlyRent as number)} />
                <Stat
                  label="Cash Flow (pre‑tax)"
                  value={gbp2.format((cashflow ?? 0))}
                  tone={(cashflow ?? 0) >= 0 ? 'good' : 'bad'}
                />
                <Stat
                  label="Coverage (DSCR)"
                  value={coverage ? `${coverage.toFixed(2)}×` : '—'}
                />
                <Stat label="Payment Type" value={repaymentType === 'repayment' ? 'Repayment' : 'Interest‑only'} />
              </div>
            </div>
          )}

          <p className="text-xs text-slate-500 mt-3">
            These figures are estimates. Actual offers depend on lender underwriting and your circumstances.
          </p>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad';
}) {
  const color =
    tone === 'good'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tone === 'bad'
      ? 'text-rose-700 dark:text-rose-400'
      : 'text-slate-800 dark:text-slate-200';
  return (
    <div className="rounded border border-slate-200 bg-white dark:bg-neutral-800 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
