"use client";

import { useEffect, useState } from "react";

export type ScoreItem = {
  key: string;
  label: string;
  value: number; // 0–100
  hint?: string; // tooltip/help text
};

export default function AIScoreBars({
  overall = 0,
  items = [],
  className = "",
}: {
  overall?: number;
  items?: ScoreItem[];
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <section
      className={`rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 ${className}`}
      aria-labelledby="ai-score-breakdown"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 id="ai-score-breakdown" className="text-lg font-semibold">
          🤖 AI Deal Score — Breakdown
        </h3>
        <div
          className="rounded-md border border-neutral-300 dark:border-neutral-700 px-2 py-1 text-sm"
          title="Overall AI score (0–100)"
          aria-label="Overall AI score"
        >
          Overall: <span className="font-semibold">{overall}</span>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((it) => {
          const width = mounted ? Math.max(0, Math.min(100, it.value)) : 0;
          const color =
            it.value >= 67 ? "bg-green-500"
            : it.value >= 34 ? "bg-amber-500"
            : "bg-red-500";

          return (
            <div key={it.key}>
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{it.label}</span>
                  {it.hint && (
                    <span
                      className="cursor-help text-xs text-neutral-500"
                      title={it.hint}
                      aria-label={`${it.label} info`}
                    >
                      ⓘ
                    </span>
                  )}
                </div>
                <span className="text-xs text-neutral-500">{it.value}%</span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full ${color} transition-all duration-700 ease-out`}
                  style={{ width: `${width}%` }}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={it.value}
                  role="progressbar"
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}