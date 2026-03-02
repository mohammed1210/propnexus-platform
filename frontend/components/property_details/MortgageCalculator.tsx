'use client';

import React, { useMemo, useState } from 'react';

import {
  type BuyerType,
  calculateSDLT,
  formatGBP,
  getBuyerTypeLabel,
} from '@/lib/finance/sdlt';
import {
  calculateLoanToValue,
  calculateMonthlyMortgagePayment,
  clampPercent,
  projectMortgage,
} from '@/lib/finance/mortgage';

type Props = { price: number };

type MiniChart = {
  basePath: string;
  overpayPath: string;
  width: number;
  height: number;
};

type MiniAmortizationChartProps = {
  chart: MiniChart;
  showOverpaySeries: boolean;
  startLabel: string;
  ariaLabel: string;
  heightClassName: string;
};

const toNumber = (raw: string): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
};

function buildLinePath(
  points: Array<{ year: number; balance: number }>,
  width: number,
  height: number,
  padding = 10,
): string {
  if (points.length < 2) return '';

  const maxYear = Math.max(...points.map((point) => point.year), 1);
  const maxBalance = Math.max(...points.map((point) => point.balance), 1);
  const innerWidth = Math.max(width - padding * 2, 1);
  const innerHeight = Math.max(height - padding * 2, 1);

  return points
    .map((point, index) => {
      const x = padding + (point.year / maxYear) * innerWidth;
      const y = height - padding - (point.balance / maxBalance) * innerHeight;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function MiniAmortizationChart({
  chart,
  showOverpaySeries,
  startLabel,
  ariaLabel,
  heightClassName,
}: MiniAmortizationChartProps) {
  return (
    <div className="mt-3 mb-2">
      <div className="text-xs text-slate-600 mb-1 flex items-center justify-between">
        <span>Start: {startLabel}</span>
        <span>End: £0</span>
      </div>
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className={`w-full text-slate-500 ${heightClassName}`}
        aria-label={ariaLabel}
        role="img"
      >
        <path
          d={chart.basePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeOpacity="0.45"
          strokeDasharray="4 4"
        />
        {showOverpaySeries && (
          <path d={chart.overpayPath} fill="none" stroke="currentColor" strokeWidth="2.5" />
        )}
      </svg>
      <div className="text-xs text-slate-600 flex items-center gap-4">
        <span>Dashed: base schedule</span>
        <span>Solid: with overpayment</span>
      </div>
    </div>
  );
}

export default function MortgageCalculator({ price }: Props) {
  // Purchase / loan
  const [depositPct, setDepositPct] = useState(25);
  const [apr, setApr] = useState(4.5);
  const [years, setYears] = useState(25);
  const [interestOnly, setInterestOnly] = useState(false);
  const [monthlyOverpayment, setMonthlyOverpayment] = useState(0);

  // Stress + rents
  const [stressApr, setStressApr] = useState(6);
  const [monthlyRent, setMonthlyRent] = useState<number | ''>('');

  // Upfront costs
  const [productFee, setProductFee] = useState(999);
  const [otherCosts, setOtherCosts] = useState(1500);
  const [buyerType, setBuyerType] = useState<BuyerType>('additional');

  // Works
  const [refurbCost, setRefurbCost] = useState(15000);
  const [contingencyPct, setContingencyPct] = useState(10);
  const [monthsOfWorks, setMonthsOfWorks] = useState(3);

  // BRRR refi
  const [arv, setArv] = useState(price);
  const [postRefurbRent, setPostRefurbRent] = useState<number | ''>('');
  const [refiLtvPct, setRefiLtvPct] = useState(75);
  const [refiApr, setRefiApr] = useState(5.25);
  const [refiYears, setRefiYears] = useState(25);
  const [refiFees, setRefiFees] = useState(1500);
  const [refiOverpayment, setRefiOverpayment] = useState(0);

  // Derived
  const deposit = useMemo(() => (price * depositPct) / 100, [price, depositPct]);
  const loan = useMemo(() => Math.max(price - deposit, 0), [price, deposit]);
  const ltvPct = useMemo(() => calculateLoanToValue(price, loan), [loan, price]);

  const n = years * 12;

  const payment = useMemo(() => {
    return calculateMonthlyMortgagePayment({
      principal: loan,
      annualRatePct: apr,
      termYears: years,
      interestOnly,
    });
  }, [apr, interestOnly, loan, years]);

  const stressPayment = useMemo(() => {
    return calculateMonthlyMortgagePayment({
      principal: loan,
      annualRatePct: stressApr,
      termYears: years,
      interestOnly,
    });
  }, [interestOnly, loan, stressApr, years]);

  const sdlt = useMemo(() => calculateSDLT(price, buyerType), [buyerType, price]);
  const duty = sdlt.total;
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
  const refiPayment = calculateMonthlyMortgagePayment({
    principal: refiLoan,
    annualRatePct: refiApr,
    termYears: refiYears,
    interestOnly: false,
  });

  const mainProjection = useMemo(
    () =>
      projectMortgage({
        principal: loan,
        annualRatePct: apr,
        termYears: years,
        monthlyOverpayment: interestOnly ? 0 : monthlyOverpayment,
      }),
    [apr, interestOnly, loan, monthlyOverpayment, years],
  );

  const mainBaseProjection = useMemo(
    () =>
      projectMortgage({
        principal: loan,
        annualRatePct: apr,
        termYears: years,
        monthlyOverpayment: 0,
      }),
    [apr, loan, years],
  );

  const refiProjection = useMemo(
    () =>
      projectMortgage({
        principal: refiLoan,
        annualRatePct: refiApr,
        termYears: refiYears,
        monthlyOverpayment: refiOverpayment,
      }),
    [refiApr, refiLoan, refiOverpayment, refiYears],
  );

  const refiBaseProjection = useMemo(
    () =>
      projectMortgage({
        principal: refiLoan,
        annualRatePct: refiApr,
        termYears: refiYears,
        monthlyOverpayment: 0,
      }),
    [refiApr, refiLoan, refiYears],
  );

  const equityReleased = Math.max(refiLoan - loan - refiFees, 0);
  const cashLeftIn = Math.max(
    cashInAtPurchase + refurbCost + contingency + holdingInterest - equityReleased,
    0,
  );

  // Cash flows
  const rentPre = typeof monthlyRent === 'number' ? monthlyRent : 0;
  const rentPost = typeof postRefurbRent === 'number' ? postRefurbRent : 0;
  const cashflowPre = rentPre - payment;
  const cashflowPost = rentPost - refiPayment;

  const totalPaid = payment * n;
  const totalInterest = interestOnly ? payment * n : mainProjection.totalInterest;

  const refiMonths = refiYears * 12;
  const totalRefiPaid = refiPayment * refiMonths;
  const totalRefiInterest = refiProjection.totalInterest;

  const baseMonths = years * 12;
  const monthsSaved = interestOnly ? 0 : Math.max(baseMonths - mainProjection.monthsToPayoff, 0);
  const overpayInterestSaved = interestOnly ? 0 : Math.max(totalPaid - loan - mainProjection.totalInterest, 0);

  const refiBaseMonths = refiYears * 12;
  const refiMonthsSaved = Math.max(refiBaseMonths - refiProjection.monthsToPayoff, 0);
  const refiInterestSaved = Math.max(totalRefiPaid - refiLoan - refiProjection.totalInterest, 0);

  const showOverpaySeries = !interestOnly && monthlyOverpayment > 0;
  const amortizationChart = useMemo(() => {
    if (interestOnly || mainProjection.yearlyBalance.length < 2) {
      return { basePath: '', overpayPath: '', width: 320, height: 120 };
    }

    const width = 320;
    const height = 120;

    const maxYear = Math.max(
      mainBaseProjection.yearlyBalance[mainBaseProjection.yearlyBalance.length - 1]?.year ?? 0,
      mainProjection.yearlyBalance[mainProjection.yearlyBalance.length - 1]?.year ?? 0,
      1,
    );
    const maxBalance = Math.max(
      mainBaseProjection.yearlyBalance[0]?.balance ?? 0,
      mainProjection.yearlyBalance[0]?.balance ?? 0,
      1,
    );

    const normalize = (points: Array<{ year: number; balance: number }>) =>
      points.map((point) => ({
        year: maxYear > 0 ? (point.year / maxYear) * 100 : 0,
        balance: maxBalance > 0 ? (point.balance / maxBalance) * 100 : 0,
      }));

    return {
      basePath: buildLinePath(normalize(mainBaseProjection.yearlyBalance), width, height),
      overpayPath: buildLinePath(normalize(mainProjection.yearlyBalance), width, height),
      width,
      height,
    };
  }, [interestOnly, mainBaseProjection.yearlyBalance, mainProjection.yearlyBalance]);

  const showRefiOverpaySeries = refiOverpayment > 0;
  const refiAmortizationChart = useMemo(() => {
    if (refiProjection.yearlyBalance.length < 2) {
      return { basePath: '', overpayPath: '', width: 320, height: 120 };
    }

    const width = 320;
    const height = 120;

    const maxYear = Math.max(
      refiBaseProjection.yearlyBalance[refiBaseProjection.yearlyBalance.length - 1]?.year ?? 0,
      refiProjection.yearlyBalance[refiProjection.yearlyBalance.length - 1]?.year ?? 0,
      1,
    );
    const maxBalance = Math.max(
      refiBaseProjection.yearlyBalance[0]?.balance ?? 0,
      refiProjection.yearlyBalance[0]?.balance ?? 0,
      1,
    );

    const normalize = (points: Array<{ year: number; balance: number }>) =>
      points.map((point) => ({
        year: maxYear > 0 ? (point.year / maxYear) * 100 : 0,
        balance: maxBalance > 0 ? (point.balance / maxBalance) * 100 : 0,
      }));

    return {
      basePath: buildLinePath(normalize(refiBaseProjection.yearlyBalance), width, height),
      overpayPath: buildLinePath(normalize(refiProjection.yearlyBalance), width, height),
      width,
      height,
    };
  }, [refiBaseProjection.yearlyBalance, refiProjection.yearlyBalance]);

  const fmt = (n: number) => formatGBP(Math.round(n));
  const pct = (n: number) => `${n.toFixed(1)}%`;

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-3">Mortgage & BRRR Calculator</h3>

      <div className="grid xl:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-4">
          <div className="rows">
            <div className="row">
              <div className="font-medium mb-2">Purchase</div>
              <div className="grid grid-cols-2 gap-3 items-end">
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Deposit (%)</span>
                <input
                  type="number"
                  value={depositPct}
                  min={0}
                  max={100}
                  onChange={(e) => setDepositPct(clampPercent(toNumber(e.target.value)))}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <div className="text-sm text-slate-600">
                Deposit: <strong>{fmt(deposit)}</strong>
              </div>

              <label className="text-sm">
                <span className="block text-slate-600 mb-1">APR (%)</span>
                <input
                  type="number"
                  step="0.01"
                  value={apr}
                  min={0}
                  onChange={(e) => setApr(toNumber(e.target.value))}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Term (years)</span>
                <input
                  type="number"
                  value={years}
                  min={1}
                  onChange={(e) => setYears(Math.max(1, toNumber(e.target.value)))}
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

              <label className="col-span-2 text-sm">
                <span className="block text-slate-600 mb-1">Monthly Overpayment (£)</span>
                <input
                  type="number"
                  value={monthlyOverpayment}
                  min={0}
                  disabled={interestOnly}
                  onChange={(e) => setMonthlyOverpayment(toNumber(e.target.value))}
                  className="w-full h-9 rounded border px-2 disabled:bg-slate-50"
                />
              </label>
            </div>
          </div>

          <div className="row">
            <div className="font-medium mb-2">Costs</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Product Fee</span>
                <input
                  type="number"
                  value={productFee}
                  min={0}
                  onChange={(e) => setProductFee(toNumber(e.target.value))}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Other Costs</span>
                <input
                  type="number"
                  value={otherCosts}
                  min={0}
                  onChange={(e) => setOtherCosts(toNumber(e.target.value))}
                  className="w-full h-9 rounded border px-2"
                />
              </label>

              <label className="col-span-2 text-sm">
                <span className="block text-slate-600 mb-1">Buyer Type</span>
                <select
                  value={buyerType}
                  onChange={(e) => setBuyerType(e.target.value as BuyerType)}
                  className="w-full h-9 rounded border px-2"
                >
                  <option value="standard">{getBuyerTypeLabel('standard')}</option>
                  <option value="additional">{getBuyerTypeLabel('additional')}</option>
                  <option value="nonresident">{getBuyerTypeLabel('nonresident')}</option>
                  <option value="additional_nonresident">
                    {getBuyerTypeLabel('additional_nonresident')}
                  </option>
                </select>
              </label>

              <div className="col-span-2 text-sm text-slate-600">
                Estimated SDLT: <strong>{fmt(duty)}</strong>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="font-medium mb-2">Works</div>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-sm col-span-1">
                <span className="block text-slate-600 mb-1">Works (£)</span>
                <input
                  type="number"
                  value={refurbCost}
                  min={0}
                  onChange={(e) => setRefurbCost(toNumber(e.target.value))}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <label className="text-sm col-span-1">
                <span className="block text-slate-600 mb-1">Contingency (%)</span>
                <input
                  type="number"
                  value={contingencyPct}
                  min={0}
                  max={100}
                  onChange={(e) => setContingencyPct(clampPercent(toNumber(e.target.value)))}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <label className="text-sm col-span-1">
                <span className="block text-slate-600 mb-1">Months of Works</span>
                <input
                  type="number"
                  value={monthsOfWorks}
                  min={0}
                  onChange={(e) => setMonthsOfWorks(toNumber(e.target.value))}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
            </div>
          </div>

          <div className="row">
            <div className="font-medium mb-2">Stress & Rent</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Stress APR (%)</span>
                <input
                  type="number"
                  step="0.01"
                  value={stressApr}
                  min={0}
                  onChange={(e) => setStressApr(toNumber(e.target.value))}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Monthly Rent (pre)</span>
                <input
                  type="number"
                  value={monthlyRent}
                  min={0}
                  onChange={(e) => setMonthlyRent(e.target.value ? toNumber(e.target.value) : '')}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
            </div>
          </div>

          <div className="row">
            <div className="font-medium mb-2">Refinance (BRRR)</div>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-sm col-span-1">
                <span className="block text-slate-600 mb-1">ARV (£)</span>
                <input
                  type="number"
                  value={arv}
                  min={0}
                  onChange={(e) => setArv(toNumber(e.target.value))}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <label className="text-sm col-span-1">
                <span className="block text-slate-600 mb-1">Refi LTV (%)</span>
                <input
                  type="number"
                  value={refiLtvPct}
                  min={0}
                  max={100}
                  onChange={(e) => setRefiLtvPct(clampPercent(toNumber(e.target.value)))}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <label className="text-sm col-span-1">
                <span className="block text-slate-600 mb-1">Refi APR (%)</span>
                <input
                  type="number"
                  step="0.01"
                  value={refiApr}
                  min={0}
                  onChange={(e) => setRefiApr(toNumber(e.target.value))}
                  className="w-full h-9 rounded border px-2"
                />
              </label>

              <label className="text-sm col-span-1">
                <span className="block text-slate-600 mb-1">Refi Term (years)</span>
                <input
                  type="number"
                  value={refiYears}
                  min={1}
                  onChange={(e) => setRefiYears(Math.max(1, toNumber(e.target.value)))}
                  className="w-full h-9 rounded border px-2"
                />
              </label>

              <label className="text-sm col-span-1">
                <span className="block text-slate-600 mb-1">Refi Fees (£)</span>
                <input
                  type="number"
                  value={refiFees}
                  min={0}
                  onChange={(e) => setRefiFees(toNumber(e.target.value))}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <label className="text-sm col-span-1">
                <span className="block text-slate-600 mb-1">Refi Overpayment (£)</span>
                <input
                  type="number"
                  value={refiOverpayment}
                  min={0}
                  onChange={(e) => setRefiOverpayment(toNumber(e.target.value))}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
              <label className="text-sm col-span-2">
                <span className="block text-slate-600 mb-1">Monthly Rent (post)</span>
                <input
                  type="number"
                  value={postRefurbRent}
                  min={0}
                  onChange={(e) => setPostRefurbRent(e.target.value ? toNumber(e.target.value) : '')}
                  className="w-full h-9 rounded border px-2"
                />
              </label>
            </div>
          </div>
          </div>
        </div>

        {/* Outputs */}
        <div className="space-y-4">
          <div className="rows">
            <div className="row">
              <div className="font-medium mb-2">Loan Snapshot</div>
              <p>
              LTV: <strong>{pct(ltvPct)}</strong>
            </p>
            <p>
              Monthly Payment: <strong>{fmt(payment)}</strong>
            </p>
            <p>
              Stress Payment @ {stressApr.toFixed(2)}%: <strong>{fmt(stressPayment)}</strong>
            </p>
            <p>
              Estimated Total Interest ({years}y): <strong>{fmt(totalInterest)}</strong>
            </p>
            {!interestOnly && (
              <>
                <p>
                  Overpay Payoff Time: <strong>{(mainProjection.monthsToPayoff / 12).toFixed(1)}y</strong>
                </p>
                <p>
                  Overpay Savings: <strong>{fmt(overpayInterestSaved)}</strong> /{' '}
                  <strong>{(monthsSaved / 12).toFixed(1)}y</strong>
                </p>
              </>
            )}
          </div>

          <div className="row">
            <div className="font-medium mb-2">Costs & Cash Needed</div>
            <p>
              Stamp Duty (auto): <strong>{fmt(duty)}</strong>
            </p>
            <p>
              Holding Interest (works period): <strong>{fmt(holdingInterest)}</strong>
            </p>
            <p>
              Project Cost (all-in): <strong>{fmt(projectCost)}</strong>
            </p>
            <p>
              Cash In at Purchase: <strong>{fmt(cashInAtPurchase)}</strong>
            </p>
          </div>

          <div className="row">
            <div className="font-medium mb-2">Sale Exit (GDV)</div>
            <p>
              GDV Profit (ARV − project cost): <strong>{fmt(gdvProfit)}</strong>
            </p>
            <p>
              Profit on Cost: <strong>{pct(profitOnCost)}</strong>
            </p>
          </div>

          <div className="row">
            <div className="font-medium mb-2">Refinance Exit (BRRR)</div>
            <p>
              Refi Loan (LTV × ARV): <strong>{fmt(refiLoan)}</strong>
            </p>
            <p>
              Equity Released (refi − old loan − fees): <strong>{fmt(equityReleased)}</strong>
            </p>
            <p>
              Cash Left in Deal: <strong>{fmt(cashLeftIn)}</strong>
            </p>
            <p>
              New Monthly Payment (post-refi): <strong>{fmt(refiPayment)}</strong>
            </p>
            <p>
              Estimated Refi Interest ({refiYears}y): <strong>{fmt(totalRefiInterest)}</strong>
            </p>
            <p>
              Refi Overpay Savings: <strong>{fmt(refiInterestSaved)}</strong> /{' '}
              <strong>{(refiMonthsSaved / 12).toFixed(1)}y</strong>
            </p>
            <MiniAmortizationChart
              chart={refiAmortizationChart}
              showOverpaySeries={showRefiOverpaySeries}
              startLabel={fmt(refiLoan)}
              ariaLabel="Refinance amortization trend chart"
              heightClassName="h-24"
            />
            <p>
              Post-refurb Cash Flow: <strong>{fmt(cashflowPost)}</strong>
            </p>
          </div>

          {!interestOnly && (
            <div className="row">
              <div className="font-medium mb-2">Amortization Preview (Year-End Balance)</div>
              <MiniAmortizationChart
                chart={amortizationChart}
                showOverpaySeries={showOverpaySeries}
                startLabel={fmt(loan)}
                ariaLabel="Amortization trend chart"
                heightClassName="h-28"
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-600">
                    <tr>
                      <th className="text-left py-1 pr-2">Year</th>
                      <th className="text-right py-1">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mainProjection.yearlyBalance.slice(0, 8).map((point) => (
                      <tr key={point.year}>
                        <td className="py-1 pr-2">{point.year}</td>
                        <td className="py-1 text-right">{fmt(point.balance)}</td>
                      </tr>
                    ))}
                    {mainProjection.yearlyBalance.length > 8 && (
                      <tr>
                        <td className="py-1 pr-2 text-slate-500">…</td>
                        <td className="py-1 text-right text-slate-500">…</td>
                      </tr>
                    )}
                    {mainProjection.yearlyBalance.length > 8 && (
                      <tr>
                        <td className="py-1 pr-2 font-medium">
                          {mainProjection.yearlyBalance[mainProjection.yearlyBalance.length - 1].year}
                        </td>
                        <td className="py-1 text-right font-medium">
                          {fmt(
                            mainProjection.yearlyBalance[mainProjection.yearlyBalance.length - 1]
                              .balance,
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="row">
            <div className="font-medium mb-2">Cash Flow (Current)</div>
            <p>
              Monthly Rent: <strong>{fmt(rentPre)}</strong>
            </p>
            <p>
              Cash Flow (pre-refurb): <strong>{fmt(cashflowPre)}</strong>
            </p>
          </div>
          </div>

          <p className="text-xs text-slate-500 mt-4">
            This is an illustrative model; stress tests, bridging interest accruals and fees are
            approximated.
          </p>
        </div>
      </div>
    </div>
  );
}
