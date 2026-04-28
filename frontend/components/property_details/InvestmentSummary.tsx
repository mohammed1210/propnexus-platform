'use client';

import { useEffect, useMemo, useState } from 'react';
import { postAiSummary } from '@/lib/api';
import type { SummaryRequest, SummaryResponse } from '@/types/ai';
import { normalizeProperty } from '@/lib/normalizeProperty';

type Props = {
  property: {
    title: string;
    location: string;
    price?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    yield_percent?: number | null;
    roi_percent?: number | null;
    description?: string | null;
    propertyType?: string | null;
    investmentType?: string | null;
  };
};

const numOrUndef = (v: unknown): number | undefined =>
  v === null || v === undefined || v === '' ? undefined : Number(v as number);

export default function InvestmentSummary({ property }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState<SummaryResponse | null>(null);

  const { title, location, price, bedrooms, bathrooms, propertyType, investmentType, description } = property;

  const normalized = useMemo(() => normalizeProperty(property as any), [property]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(false);
      try {
        const payload: SummaryRequest = {
          title,
          location: String(location ?? ''),
          price: numOrUndef(price), // ✅ narrowed
          bedrooms: numOrUndef(bedrooms), // ✅ narrowed
          bathrooms: numOrUndef(bathrooms), // ✅ narrowed
          yield_percent: normalized.yieldPct ?? undefined,
          roi_percent: normalized.roiPct ?? undefined,
          propertyType: propertyType ?? undefined,
          investmentType: investmentType ?? undefined,
          description: description ?? undefined,
        };

        const res = await postAiSummary(payload);
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [
    title,
    location,
    price,
    bedrooms,
    bathrooms,
    propertyType,
    investmentType,
    description,
    normalized.yieldPct,
    normalized.roiPct,
  ]);

  if (loading)
    return (
      <div
        data-testid="investment-summary-loading"
        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-400"
      >
        Loading AI investment notes…
      </div>
    );

  if (error)
    return (
      <div
        role="alert"
        data-testid="investment-summary-fallback"
        className="rounded-lg border border-rose-200/60 dark:border-rose-800/30 bg-rose-50 dark:bg-rose-900/10 p-4"
      >
        <div className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300 mb-1">
          Summary unavailable
        </div>
        <p className="text-sm text-rose-800 dark:text-rose-200">
          We could not generate an investment summary right now. Please try again later.
        </p>
      </div>
    );

  if (!data)
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20 p-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">No summary available.</p>
      </div>
    );

  return (
    <div data-testid="investment-summary-text" className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/30 sm:p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        AI analyst note
      </div>
      {data.summary && (
        <p className="mt-3 text-sm leading-relaxed text-slate-800 dark:text-slate-200">{data.summary}</p>
      )}

      {Array.isArray(data.bullets) && data.bullets.length > 0 && (
        <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.bullets.map((b, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
