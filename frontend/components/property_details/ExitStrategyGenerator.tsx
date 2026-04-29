'use client';

import { useState } from 'react';
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

function compactText(value: unknown, maxLength = 120): string {
  if (typeof value !== 'string') return '';
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const slice = clean.slice(0, maxLength - 1);
  const boundary = slice.lastIndexOf(' ');
  return `${slice.slice(0, boundary > 60 ? boundary : slice.length).trim()}…`;
}

function compactStep(steps: Strategy['steps']): string {
  if (!Array.isArray(steps)) return '';
  return steps.map((step) => compactText(step, 95)).find(Boolean) ?? '';
}

function bestForSummary(strategy: Strategy, horizon: string): string {
  const hay = `${strategy.title ?? ''} ${strategy.rationale ?? ''}`.toLowerCase();
  if (/flip|resale|sell|auction|quick|refurb/.test(hay)) return 'Best if uplift can be proven quickly.';
  if (/refinanc|brrr|brr|remortgage|stabil/.test(hay)) return 'Ideal if rent supports refinance debt.';
  if (/hold|btl|rent|hmo|cashflow/.test(hay)) return 'Best for income-led investors.';
  return horizon === 'Short-term' ? 'Best for faster capital recycling.' : 'Best for a balanced risk route.';
}

function upsideSummary(strategy: Strategy): string {
  const hay = `${strategy.title ?? ''} ${strategy.rationale ?? ''}`.toLowerCase();
  if (/flip|resale|sell|auction|refurb/.test(hay)) return 'Potential value uplift on resale.';
  if (/refinanc|brrr|brr|remortgage/.test(hay)) return 'Recycle capital after stabilisation.';
  if (/hold|btl|rent|hmo|cashflow/.test(hay)) return 'Income-led route with optional later sale.';
  return compactText(strategy.rationale, 90) || 'Keeps the exit route flexible.';
}

function riskSummary(strategy: Strategy): string {
  return compactText(strategy.risk, 90) || 'Validate rent, costs and resale evidence first.';
}

function uniqueTopStrategies(strategies: Strategy[]): Strategy[] {
  const seen = new Set<string>();
  const out: Strategy[] = [];

  for (const strategy of strategies) {
    const key = compactText(strategy.title, 36).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(strategy);
    if (out.length >= MAX_VISIBLE_STRATEGIES) break;
  }

  return out;
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
      setStrategies(uniqueTopStrategies(res?.strategies ?? []));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to generate strategies');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-200 bg-white/90 p-4 shadow-sm dark:border-brand-900/70 dark:bg-slate-950/40 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
            Top exit routes
          </div>
          <h4 className="mt-1 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
            Compare route choices
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Generate a short, investor-ready comparison of the clearest sell, refinance or hold routes.
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
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {strategies.map((s, i) => {
            const horizon = horizonTag(s);
            const nextStep = compactStep(s.steps) || 'Verify costs, rent and comparable values.';
            const upside = upsideSummary(s);
            const risk = riskSummary(s);
            const bestFor = bestForSummary(s, horizon);
            return (
              <article
                key={i}
                aria-label={`strategy-${i + 1}`}
                className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white shadow-sm">
                    {i + 1}
                  </span>
                  <span
                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900/20 dark:text-slate-200"
                    aria-label="Strategy horizon"
                  >
                    {horizon}
                  </span>
                </div>

                <h5 className="mt-3 text-base font-semibold leading-snug text-slate-950 dark:text-white">
                  {compactText(s.title, 58) || 'Exit route'}
                </h5>
                <p className="mt-1 text-xs font-medium text-brand-700 dark:text-brand-300">{bestFor}</p>

                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Upside
                    </dt>
                    <dd className="mt-0.5 leading-relaxed text-slate-700 dark:text-slate-300">{upside}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Risk
                    </dt>
                    <dd className="mt-0.5 leading-relaxed text-slate-700 dark:text-slate-300">{risk}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Next step
                    </dt>
                    <dd className="mt-0.5 leading-relaxed text-slate-700 dark:text-slate-300">{nextStep}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
