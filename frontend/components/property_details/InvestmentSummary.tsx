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

  if (loading) return <p data-testid="investment-summary-loading">Loading summary…</p>;
  if (error)
    return (
      <p role="alert" className="text-red-600">
        Error: {error}
      </p>
    );
  if (!data) return <p className="text-sm opacity-70">No summary available.</p>;

  return (
    <div data-testid="investment-summary-text" className="space-y-2">
      {data.summary && <p>{data.summary}</p>}
      {Array.isArray(data.bullets) && data.bullets.length > 0 && (
        <ul className="list-disc pl-5">
          {data.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}

      {/* Visual scores */}
      <div className="space-y-3">
        <ScoreBar
          label="ROI strength"
          value={roiScore}
          fallbackLabel={property.roi_percent != null ? `${property.roi_percent}%` : 'N/A'}
        />
        <ScoreBar
          label="Yield potential"
          value={yieldScore}
          fallbackLabel={property.yield_percent != null ? `${property.yield_percent}%` : 'N/A'}
        />
      </div>

      {/* Tiny explainer */}
      <details className="mt-3 text-sm text-slate-500">
        <summary className="cursor-pointer select-none inline-flex items-center gap-1">
          <span>❓</span> What do these scores mean?
        </summary>
        <div className="mt-2">
          These bars are a simple visual based on the ROI and gross yield figures for this listing.
          They’re scaled to typical residential ranges (ROI ≈ 0–25%, Yield ≈ 0–12%) to give a quick
          sense of strength at a glance. Always validate with your own numbers.
        </div>
      </details>
    </div>
  );
}

/** Tiny, dependency-free progress bar */
function ScoreBar({
  label,
  value,
  fallbackLabel,
}: {
  label: string;
  value: number | null;
  fallbackLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-xs text-slate-500">
          {value == null ? fallbackLabel : `${Math.round(value)} / 100`}
        </span>
      </div>
      <div className="h-2 w-full rounded bg-slate-200 overflow-hidden">
        <div
          style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
          className="h-full rounded bg-gradient-to-r from-blue-500 to-emerald-500 transition-[width] duration-500"
        />
      </div>
    </div>
  );
}
