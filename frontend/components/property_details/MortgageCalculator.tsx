'use client';
import React, { useMemo, useState } from 'react';

type Props = { price: number };

/* ---------------- Stamp duty (basic Eng/Wales bands) ---------------- */
function calcStampDuty(price: number, isAdditional: boolean) {
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

/* ---------------- Component ---------------- */
export default function MortgageCalculator({ price }: Props) {
  /* Purchase/loan */
  const [depositPct, setDepositPct] = useState(10);
  const [apr, setApr] = useState(4.5);
  const [years, setYears] = useState(25);
  const [interestOnly, setInterestOnly] = useState(false);

  /* Stress test + rent (pre‑refurb) */
  const [stressApr, setStressApr] = useState(6);
  const [monthlyRent, setMonthlyRent] = useState<number | ''>('');

  /* Fees / costs at purchase */
  const [productFee, setProductFee] = useState(999);
  const [otherCosts, setOtherCosts] = useState(1500);
  const [btlSurcharge, setBtlSurcharge] = useState(true);

  /* Refurb & BRRR bits */
  const [refurbCost, setRefurbCost] = useState(15000);
  const [contingencyPct, setContingencyPct] = useState(10);
  const [monthsOfWorks, setMonthsOfWorks] = useState(3);

  const [arv, setArv] = useState(price);           // After‑repair value
  const [postRefurbRent, setPostRefurbRent] = useState<number | ''>(''); // optional

  const [refiLtvPct, setRefiLtvPct] = useState(75); // refinance LTV
  const [refiApr, setRefiApr] = useState(5.25);
  const [refiFees, setRefiFees] = useState(1500);   // broker/valuation/legal at refi

  /* ---------- Derived purchase numbers ---------- */
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

  /* ---------- Refurb / project cost ---------- */
  const contingency = useMemo(() => (refurbCost * contingencyPct) / 100, [refurbCost, contingencyPct]);

  // Holding cost during works (approx): interest-only on the initial loan for X months
  const holdingInterest = useMemo(() => loan * (apr / 100) * (monthsOfWorks / 12), [loan, apr, monthsOfWorks]);

  // Cash in at purchase
  const cashInAtPurchase = useMemo(
    () => deposit + productFee + otherCosts + duty,
    [deposit, productFee, otherCosts, duty]
  );

  // All-in project cost (excludes refinance fees)
  const projectCost = useMemo(
    () => price + refurbCost + contingency + productFee + otherCosts + duty + holdingInterest,
    [price, refurbCost, contingency, productFee, otherCosts, duty, holdingInterest]
  );

  /* ---------- Sale metrics (GDV route) ---------- */
  const gdvProfit = useMemo(() => Math.max(arv - projectCost, 0), [arv, projectCost]);
  const profitOnCostPct = useMemo(() => (projectCost > 0 ? (gdvProfit / projectCost) * 100 : 0), [gdvProfit, projectCost]);

  /* ---------- Refinance metrics (BRRR route) ---------- */
  const refiLoan = useMemo(() => (arv * refiLtvPct) / 100, [arv, refiLtvPct]);
  const refiMonthlyRate = useMemo(() => refiApr / 100 / 12, [refiApr]);

  const refiPayment = useMemo(() => {
    // assume new 25yr P&I unless interest-only makes more sense later
    const refiN = 25 * 12;
    return (refiLoan * refiMonthlyRate) / (1 - Math.pow(1 + refiMonthlyRate, -refiN));
  }, [refiLoan, refiMonthlyRate]);

  const equityReleased = useMemo(() => Math.max(refiLoan - loan - refiFees, 0), [refiLoan, loan, refiFees]);

  // Cash left in deal after refinance (cannot be negative)
  const cashLeftInDeal = useMemo(
    () => Math.max(cashInAtPurchase + refurbCost + contingency + holdingInterest - equityReleased, 0),
    [cashInAtPurchase, refurbCost, contingency, holdingInterest, equityReleased]
  );

  // Post‑refurb rental metrics (if user provides rent)
  const rentPre = typeof monthlyRent === 'number' ? monthlyRent : 0;
  const rentPost = typeof postRefurbRent === 'number' ? postRefurbRent : 0;

  const cashflowPre = rentPre - payment;
  const cashflowPost = rentPost - refiPayment;

  const dscrPre = payment > 0 ? rentPre / payment : 0;
  const dscrPost = refiPayment > 0 ? rentPost / refiPayment : 0;

  const cocReturn = useMemo(
    () => (cashLeftInDeal > 0 ? ((cashflowPost * 12) / cashLeftInDeal) * 100 : 0),
    [cashflowPost, cashLeftInDeal]
  );
  const paybackYears = useMemo(
    () => (cashflowPost * 12 > 0 ? cashLeftInDeal / (cashflowPost * 12) : Infinity),
    [cashLeftInDeal, cashflowPost]
  );

  /* ---------- helpers ---------- */
  const fmt = (v: number) => `£${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const fmt2 = (v: number) => `£${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pct = (v: number) => `${v.toFixed(1)}%`;
  const yrs = (v: number) => (v === Infinity || Number.isNaN(v) ? '—' : `${v.toFixed(1)} yrs`);
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
      <h3 className="text-xl font-semibold mb-3">🏦 Mortgage & BRRR Calculator</h3>

      <div className="grid xl:grid-cols-2 gap-6">
        {/* ---------- LEFT: Inputs ---------- */}
        <div className="space-y-6">
          {/* Purchase */}
          <Section title="Purchase">
            <Field label="Purchase Price">
              <input type="number" value={price} readOnly className="w-44 rounded border border-gray-300 bg-gray-100 px-3 py-2 dark:bg-neutral-800" />
            </Field>
            <Field label={`Deposit (${pct(depositPct)})`}>
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={100} value={depositPct} onChange={(e) => setDepositPct(Number(e.target.value))} className="w-24 rounded border px-3 py-2" />
                <div className="flex flex-wrap gap-1">{[10, 15, 20, 25, 40].map(chip)}</div>
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
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={interestOnly} onChange={(e) => setInterestOnly(e.target.checked)} className="h-4 w-4" />
              Interest‑only
            </label>
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
          </Section>

          {/* Refurb */}
          <Section title="Refurb">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Works Cost">
                <input type="number" value={refurbCost} onChange={(e) => setRefurbCost(Number(e.target.value))} className="w-full rounded border px-3 py-2" />
              </Field>
              <Field label="Contingency (%)">
                <input type="number" min={0} max={30} value={contingencyPct} onChange={(e) => setContingencyPct(Number(e.target.value))} className="w-full rounded border px-3 py-2" />
              </Field>
            </div>
            <Field label="Months of Works">
              <input type="number" min={0} max={18} value={monthsOfWorks} onChange={(e) => setMonthsOfWorks(Number(e.target.value))} className="w-28 rounded border px-3 py-2" />
            </Field>
            <Field label="Monthly Rent (pre‑refurb, optional)">
              <input type="number" placeholder="e.g. 1,200" value={typeof monthlyRent === 'number' ? monthlyRent : ''} onChange={(e) => setMonthlyRent(e.target.value === '' ? '' : Number(e.target.value))} className="w-40 rounded border px-3 py-2" />
            </Field>
          </Section>

          {/* Refinance */}
          <Section title="Refinance (BRRR)">
            <Field label="After‑Repair Value (ARV)">
              <input type="number" value={arv} onChange={(e) => setArv(Number(e.target.value))} className="w-44 rounded border px-3 py-2" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Refi LTV (%)">
                <input type="number" min={50} max={85} value={refiLtvPct} onChange={(e) => setRefiLtvPct(Number(e.target.value))} className="w-full rounded border px-3 py-2" />
              </Field>
              <Field label="Refi APR (%)">
                <input type="number" step="0.01" value={refiApr} onChange={(e) => setRefiApr(Number(e.target.value))} className="w-full rounded border px-3 py-2" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Refi Fees (broker/valuation)">
                <input type="number" value={refiFees} onChange={(e) => setRefiFees(Number(e.target.value))} className="w-full rounded border px-3 py-2" />
              </Field>
              <Field label="Monthly Rent (post‑refurb)">
                <input type="number" placeholder="e.g. 1,450" value={typeof postRefurbRent === 'number' ? postRefurbRent : ''} onChange={(e) => setPostRefurbRent(e.target.value === '' ? '' : Number(e.target.value))} className="w-full rounded border px-3 py-2" />
              </Field>
            </div>
          </Section>

          {/* Stress Test */}
          <Section title="Stress Test">
            <div className="flex items-center gap-3">
              <input type="range" min={3} max={9} step={0.25} value={stressApr} onChange={(e) => setStressApr(Number(e.target.value))} className="w-48" />
              <input type="number" step="0.01" value={stressApr} onChange={(e) => setStressApr(Number(e.target.value))} className="w-20 rounded border px-2 py-1" />
              <span className="text-sm text-slate-500">%</span>
            </div>
          </Section>
        </div>

        {/* ---------- RIGHT: Outputs ---------- */}
        <div className="space-y-5">
          <Section title="Loan Snapshot">
            <KPI label="Loan Amount" value={fmt(loan)} />
            <KPI label="LTV" value={pct(ltvPct)} />
            <KPI label="Monthly Payment" value={fmt2(payment)} highlight />
            <KPI label={`Stress Payment @ ${stressApr.toFixed(2)}%`} value={fmt2(paymentStress)} />
          </Section>

          <Section title="Costs & Cash Needed">
            <KPI label="Stamp Duty (auto)" value={fmt(duty)} />
            <KPI label="Holding Interest (works period)" value={fmt(holdingInterest)} />
            <KPI label="Project Cost (all‑in)" value={fmt(projectCost)} />
            <KPI label="Cash In at Purchase" value={fmt(cashInAtPurchase)} />
          </Section>

          <Section title="Sale Exit (GDV)">
            <KPI label="GDV Profit (ARV − project cost)" value={fmt(gdvProfit)} />
            <KPI label="Profit on Cost" value={pct(profitOnCostPct)} />
          </Section>

          <Section title="Refinance Exit (BRRR)">
            <KPI label="Refi Loan (LTV × ARV)" value={fmt(refiLoan)} />
            <KPI label="Equity Released (refi − old loan − fees)" value={fmt(Math.max(equityReleased, 0))} />
            <KPI label="Cash Left in Deal" value={fmt(cashLeftInDeal)} highlight />
            <KPI label="New Monthly Payment (post‑refi)" value={fmt2(refiPayment)} />
            {typeof postRefurbRent === 'number' && (
              <>
                <KPI label="Post‑refurb Cash Flow / mo" value={fmt2(cashflowPost)} />
                <KPI label="Coverage (DSCR) post‑refi" value={`${(dscrPost || 0).toFixed(2)}×`} />
                <KPI label="Cash‑on‑Cash (post‑refi)" value={pct(cocReturn)} />
                <KPI label="Payback (years)" value={yrs(paybackYears)} />
              </>
            )}
          </Section>

          {typeof monthlyRent === 'number' && monthlyRent > 0 && (
            <Section title="Pre‑refurb Hold (optional)">
              <MiniKPI label="Cash Flow / mo (pre)" value={fmt2(cashflowPre)} positive={cashflowPre >= 0} />
              <MiniKPI label="Coverage (DSCR) pre" value={(dscrPre || 0).toFixed(2) + '×'} positive={dscrPre >= 1.25} />
            </Section>
          )}

          <p className="text-xs text-slate-500">
            Assumptions are simplified. Always validate with your broker/solicitor. Stamp duty bands are England/Wales and may
            change; bridging/interest‑accrual is approximated.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- small UI helpers ---------------- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border p-3">
      <div className="font-semibold mb-2">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

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
