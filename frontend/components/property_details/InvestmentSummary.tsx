'use client';

import { useEffect, useState } from 'react';
import { postAiSummary } from '@/lib/api';
import type { SummaryRequest, SummaryResponse } from '@/types/ai';

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
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SummaryResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const payload: SummaryRequest = {
          title: property.title,
          location: String(property.location ?? ''),
          price: numOrUndef(property.price), // ✅ narrowed
          bedrooms: numOrUndef(property.bedrooms), // ✅ narrowed
          bathrooms: numOrUndef(property.bathrooms), // ✅ narrowed
          yield_percent: numOrUndef(property.yield_percent),
          roi_percent: numOrUndef(property.roi_percent),
          propertyType: property.propertyType ?? undefined,
          investmentType: property.investmentType ?? undefined,
          description: property.description ?? undefined,
        };

        const res = await postAiSummary(payload);
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load summary');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [
    property.title,
    property.location,
    property.price,
    property.bedrooms,
    property.bathrooms,
    property.yield_percent,
    property.roi_percent,
    property.propertyType,
    property.investmentType,
    property.description,
  ]);

  if (loading) return <p data-testid="investment-summary-loading" className="text-sm text-slate-600 dark:text-slate-400">Loading summary…</p>;
  if (error)
    return (
      <p role="alert" className="text-sm text-red-600">
        Error: {error}
      </p>
    );
  if (!data) return <p className="text-sm text-slate-600 dark:text-slate-400">No summary available.</p>;

  return (
    <div data-testid="investment-summary-text" className="space-y-4">
      {data.summary && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/30 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            Summary
          </div>
          <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">{data.summary}</p>
        </div>
      )}

      {Array.isArray(data.bullets) && data.bullets.length > 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            Key points
          </div>
          <ul className="space-y-2">
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
