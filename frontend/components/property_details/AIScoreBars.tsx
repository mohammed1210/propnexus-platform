'use client';

import React from 'react';

type Item = {
  label: string;
  value: number; // 0–100
};

export default function AIScoreBars({
  overall,
  items,
  showHeader = true,
  className = '',
}: {
  overall: number; // 0–100
  items: Item[];
  showHeader?: boolean;
  className?: string;
}) {
  const safe = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

  const barGradient =
    'bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 dark:from-red-400 dark:via-yellow-400 dark:to-green-400';

  return (
    <section className={className}>
      {showHeader && (
        <div className="mb-2 flex items-center gap-2">
          <div className="text-lg font-semibold">AI Deal Score</div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
            beta
          </span>
        </div>
      )}

      {/* Overall pill */}
      <div className="mb-3">
        <div className="text-sm text-neutral-600 dark:text-neutral-300 mb-1">Overall</div>
        <div
          className="h-2 w-full rounded bg-neutral-200 dark:bg-neutral-800 overflow-hidden relative"
          aria-label={`Overall score ${safe(overall)} out of 100`}
        >
          <div aria-hidden className={`absolute inset-0 ${barGradient}`} />
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 bg-neutral-200 dark:bg-neutral-800 transition-[width] duration-500"
            style={{ width: `${100 - safe(overall)}%` }}
          />
        </div>
        <div className="text-xs text-neutral-500 mt-1">{safe(overall)} / 100</div>
      </div>

      {/* Breakdown */}
      <ul className="space-y-2">
        {items.map((it, idx) => (
          <li key={idx}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-700 dark:text-neutral-200">{it.label}</span>
              <span className="text-neutral-500">{safe(it.value)}%</span>
            </div>
            <div className="h-2 w-full rounded bg-neutral-200 dark:bg-neutral-800 overflow-hidden relative">
              <div aria-hidden className={`absolute inset-0 ${barGradient}`} />
              <div
                aria-hidden
                className="absolute inset-y-0 right-0 bg-neutral-200 dark:bg-neutral-800 transition-[width] duration-500"
                style={{ width: `${100 - safe(it.value)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
