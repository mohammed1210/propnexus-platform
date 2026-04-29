'use client';

import React, { useState } from 'react';
import { postAiStrategies } from '@/lib/api';
import type { StrategiesRequest, StrategiesResponse, Strategy } from '@/types/ai';

type Props = {
  title: string;
  location: string;
  price?: number;
  yieldPercent?: number;
  roiPercent?: number;
  propertyType?: string;
  investmentType?: string;
  description?: string;
};

const MAX_VISIBLE_STRATEGIES = 3;

function compactText(value: unknown, maxLength = 180): string {
  if (typeof value !== 'string') return '';
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const slice = clean.slice(0, maxLength - 1);
  const boundary = slice.lastIndexOf(' ');
  return `${slice.slice(0, boundary > 80 ? boundary : slice.length).trim()}…`;
}

function compactSteps(steps: Strategy['steps']): string[] {
  if (!Array.isArray(steps)) return [];
  return steps.map((step) => compactText(step, 115)).filter(Boolean).slice(0, 3);
}

function bestForSummary(strategy: Strategy, horizon: string): string {
  const hay = `${strategy.title ?? ''} ${strategy.rationale ?? ''}`.toLowerCase();
  if (/flip|resale|sell|auction|quick|refurb/.test(hay)) return 'Best if uplift can be proven quickly.';
  if (/refinanc|brrr|brr|remortgage|stabil/.test(hay)) return 'Ideal if rent supports refinance debt.';
  if (/hold|btl|rent|hmo|cashflow/.test(hay)) return 'Best for income-led investors.';
  return horizon === 'Short-term' ? 'Best for faster capital recycling.' : 'Best for a balanced risk route.';
}

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
          yield_percent: props.yieldPercent,
          roi_percent: props.roiPercent,
          propertyType: props.propertyType,
          investmentType: props.investmentType,
          description: props.description,
        },
        constraints: {}, // extend later from UI
      };

      const res: StrategiesResponse = await postAiStrategies(payload);
      setStrategies((res?.strategies ?? []).slice(0, MAX_VISIBLE_STRATEGIES));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to generate strategies');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-200 bg-white/90 p-4 shadow-sm dark:border-brand-900/70 dark:bg-slate-950/40 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
            Exit plan generator
          </div>
          <h4 className="mt-1 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
            Compare the top investor routes
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Generate a concise route-by-route plan using the deal metrics above, then compare timing, execution steps and risk.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          data-loading={loading ? 'true' : undefined}
        >
          {loading ? 'Generating…' : 'Generate exit plan'}
        </button>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-3">
        {['Sell for uplift', 'Refinance and recycle', 'Hold for income'].map((route) => (
          <div
            key={route}
            className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 font-semibold dark:border-slate-800 dark:bg-slate-900/30"
          >
            {route}
          </div>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-rose-200/60 bg-rose-50 p-4 dark:border-rose-800/30 dark:bg-rose-900/10"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300 mb-1">
            Strategies unavailable
          </div>
          <p className="text-sm text-rose-800 dark:text-rose-200">{error}</p>
        </div>
      )}

      {strategies && strategies.length === 0 && !loading ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/30">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No strong exit routes were returned. Check the source deal metrics and try again once price, rent and location data are available.
          </p>
        </div>
      ) : null}

      {strategies && strategies.length > 0 ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {strategies.map((s, i) => {
            const horizon = horizonTag(s);
            const rationale = compactText(s.rationale, 155);
            const steps = compactSteps(s.steps);
            const risk = compactText(s.risk, 115);
            const bestFor = bestForSummary(s, horizon);
            return (
              <article
                key={i}
                aria-label={`strategy-${i + 1}`}
                className="flex min-h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/50"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-sm">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                        aria-label="Strategy horizon"
                      >
                        {horizon}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Route {i + 1}
                      </span>
                    </div>
                    <h5 className="mt-2 text-base font-semibold leading-snug text-slate-950 dark:text-white">
                      {compactText(s.title, 72) || 'Exit route'}
                    </h5>
                    <p className="mt-1 text-xs font-medium text-brand-700 dark:text-brand-300">{bestFor}</p>
                  </div>
                </div>

                {rationale ? (
                  <div className="mt-3">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Why this fits
                    </div>
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{rationale}</p>
                  </div>
                ) : null}

                {steps.length > 0 ? (
                  <div className="mt-3">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Next steps
                    </div>
                    <ol className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                      {steps.map((st, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                            {idx + 1}
                          </span>
                          <span>{st}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                <div className="mt-auto pt-4">
                  {risk ? (
                    <div className="rounded-xl border border-amber-200/70 bg-amber-50/80 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-300">
                        Watch-out
                      </div>
                      <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-100">{risk}</p>
                    </div>
                  ) : null}
                  <button
                    className="mt-3 inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
                    onClick={() => {
                      const text =
                        `${s.title}\n\n` +
                        (rationale ? `Why:\n${rationale}\n\n` : '') +
                        (steps.length ? `How:\n${steps.map((x, n) => `${n + 1}. ${x}`).join('\n')}\n\n` : '') +
                        (risk ? `Risk:\n${risk}` : '');
                      if (navigator?.clipboard) {
                        navigator.clipboard.writeText(text);
                      }
                    }}
                  >
                    Copy route
                  </button>
                </div>
              </article>
            );
          })}
            </div>
      ) : null}
    </div>
  );
}
