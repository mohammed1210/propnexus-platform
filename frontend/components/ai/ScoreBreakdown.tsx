'use client';

/**
 * AI Deal Scoring Breakdown (0–100 bars)
 */

import React from 'react';

type ScoreBreakdownProps = {
  capitalGrowth?: number;
  rentalYield?: number;
  areaDemand?: number;
  transportLinks?: number;
  schools?: number;
  overall?: number;
};

function Bar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-medium">{v}%</span>
      </div>
      <div
        className="h-2 w-full rounded bg-slate-200 dark:bg-slate-800 overflow-hidden relative"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
        role="progressbar"
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 dark:from-red-400 dark:via-yellow-400 dark:to-green-400"
        />
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 bg-slate-200 dark:bg-slate-800 transition-[width]"
          style={{ width: `${100 - v}%` }}
        />
      </div>
    </div>
  );
}

export default function ScoreBreakdown(props: ScoreBreakdownProps) {
  const {
    capitalGrowth = 60,
    rentalYield = 70,
    areaDemand = 65,
    transportLinks = 72,
    schools = 68,
    overall,
  } = props;

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 md:p-5 space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">AI Deal Scoring Breakdown</h3>
        {typeof overall === 'number' && (
          <span className="inline-flex items-center rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-700 dark:text-indigo-300">
            Overall: {Math.round(overall)}%
          </span>
        )}
      </header>

      <div className="space-y-3">
        <Bar label="Capital Growth" value={capitalGrowth} />
        <Bar label="Rental Yield" value={rentalYield} />
        <Bar label="Area Demand" value={areaDemand} />
        <Bar label="Transport Links" value={transportLinks} />
        <Bar label="Schools" value={schools} />
      </div>

      <p className="text-xs text-slate-500">
        Tip: Scores combine deal metrics with local area intelligence. They’re guidance, not
        financial advice.
      </p>
    </section>
  );
}
