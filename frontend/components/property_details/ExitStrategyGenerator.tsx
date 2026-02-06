'use client';

import React, { useState } from 'react';
import { postAiStrategies } from '@/lib/api';
import type { StrategiesRequest, StrategiesResponse, Strategy } from '@/types/ai';

type Props = {
  title: string;
  location: string;
  price?: number;
  yield_percent?: number;
  roi_percent?: number;
  propertyType?: string;
  investmentType?: string;
  description?: string;
};

export default function ExitStrategyGenerator(props: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<Strategy[] | null>(null);

  function horizonTag(s: Strategy): 'Short-term' | 'Medium-term' | 'Long-term' {
    const hay = `${s?.title ?? ''} ${s?.rationale ?? ''}`.toLowerCase();

    // Lightweight heuristics to avoid extra UI fields.
    if (/flip|resale|sell|auction|quick|refurb\s*and\s*sell/.test(hay)) return 'Short-term';
    if (/refinanc|brrr|brr|remortgage|stabiliz|stabilise/.test(hay)) return 'Medium-term';
    if (/hold|btl|rent|hmo|long\s*term|portfolio|cashflow/.test(hay)) return 'Long-term';
    return 'Medium-term';
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const payload: StrategiesRequest = {
        property: {
          title: props.title,
          location: props.location,
          price: props.price,
          yield_percent: props.yield_percent,
          roi_percent: props.roi_percent,
          propertyType: props.propertyType,
          investmentType: props.investmentType,
          description: props.description,
        },
        constraints: {}, // extend later from UI
      };

      const res: StrategiesResponse = await postAiStrategies(payload);
      setStrategies(res?.strategies ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to generate strategies');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          Common exit routes investors consider for similar properties.
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="btn-primary"
          data-loading={loading ? 'true' : undefined}
        >
          {loading ? 'Generating…' : 'Generate strategies'}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200/60 dark:border-rose-800/30 bg-rose-50 dark:bg-rose-900/10 p-4"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300 mb-1">
            Strategies unavailable
          </div>
          <p className="text-sm text-rose-800 dark:text-rose-200">{error}</p>
        </div>
      )}

      {strategies && strategies.length === 0 && !loading ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20 p-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">No strategies returned.</p>
        </div>
      ) : null}

      <div className="space-y-3">
        {strategies?.slice(0, 4).map((s, i) => (
          <article
            key={i}
            aria-label={`strategy-${i + 1}`}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs font-bold">
                    {i + 1}
                  </span>
                  <h4 className="font-semibold text-slate-900 dark:text-white truncate">{s.title}</h4>
                  <span
                    className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                    aria-label="Strategy horizon"
                  >
                    {horizonTag(s)}
                  </span>
                </div>
              </div>
              <button
                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => {
                  const text =
                    `${s.title}\n\n` +
                    (s.rationale ? `Why:\n${s.rationale}\n\n` : '') +
                    (s.steps?.length
                      ? `How:\n${s.steps.map((x, n) => `${n + 1}. ${x}`).join('\n')}\n\n`
                      : '') +
                    (s.risk ? `Risk:\n${s.risk}` : '');
                  if (navigator?.clipboard) {
                    navigator.clipboard.writeText(text);
                  }
                }}
              >
                Copy
              </button>
            </div>

            {s.rationale && (
              <div className="mt-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                  Why
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{s.rationale}</p>
              </div>
            )}

            {Array.isArray(s.steps) && s.steps.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                  How
                </div>
                <ol className="list-decimal pl-5 text-sm space-y-1 text-slate-700 dark:text-slate-300">
                  {s.steps.map((st: string, idx: number) => (
                    <li key={idx}>{st}</li>
                  ))}
                </ol>
              </div>
            )}

            {s.risk && (
              <div className="mt-3 rounded-lg bg-rose-50 dark:bg-rose-900/10 border border-rose-200/60 dark:border-rose-800/30 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300 mb-1">
                  Risk
                </div>
                <p className="text-sm text-rose-800 dark:text-rose-200">{s.risk}</p>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
