import React from "react";

interface ScoreItem {
  label: string;
  value: number;
  color?: string;
  tooltip?: string;
}

export default function AIScoreBars({
  overall = 0,
  items = [],
  className = "",
  showHeader = true, // NEW: lets you hide the header
}: {
  overall?: number;
  items?: ScoreItem[];
  className?: string;
  showHeader?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 ${className}`}
      aria-labelledby="ai-score-breakdown"
    >
      {showHeader && (
        <div className="mb-3 flex items-center justify-between">
          <h3
            id="ai-score-breakdown"
            className="text-lg font-semibold"
          >
            🤖 AI Deal Score — Breakdown
          </h3>
          <div className="rounded-md border px-2 py-1 text-sm">
            Overall: <span className="font-semibold">{overall}</span>
          </div>
        </div>
      )}

      <div className="space-y-2 sm:space-y-3">
        {items.map((it, idx) => {
          const width = Math.min(100, Math.max(0, it.value));
          const color = it.color || "bg-blue-500";
          return (
            <div key={idx}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium">
                  {it.label}
                  {it.tooltip && (
                    <span
                      className="ml-1 cursor-help text-xs text-gray-400"
                      title={it.tooltip}
                    >
                      ⓘ
                    </span>
                  )}
                </span>
                <span className="text-sm">{width}%</span>
              </div>

              {/* Updated bar track & fill */}
              <div className="h-3 w-full overflow-hidden rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full ${color} transition-all duration-700 ease-out`}
                  style={{ width: `${width}%` }}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={it.value}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Shortened disclaimer */}
      <p className="mt-2 text-sm text-slate-600">
        Indicative only — based on yield, ROI, area demand and risk.
      </p>
    </section>
  );
}