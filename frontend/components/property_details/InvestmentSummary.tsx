'use client';

import { useEffect, useState } from 'react';
import { postAiSummary } from '@/lib/api';
import type { SummaryRequest, SummaryResponse } from '@/types/ai';

type Props = {
  property: {
    title?: string | null;
    location?: string | null;
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

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const payload: SummaryRequest = {
          title: property.title ?? '',
          location: property.location ?? '',
          price: numOrUndef(property.price),
          bedrooms: numOrUndef(property.bedrooms),
          bathrooms: numOrUndef(property.bathrooms),
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
    })();

    return () => {
      cancelled = true;
    };
  }, [
    property?.title,
    property?.location,
    property?.price,
    property?.bedrooms,
    property?.bathrooms,
    property?.yield_percent,
    property?.roi_percent,
    property?.propertyType,
    property?.investmentType,
    property?.description,
  ]);

  if (loading) return <p data-testid="investment-summary-loading">Loading summary…</p>;
  if (error) return <p role="alert" className="text-red-600">Error: {error}</p>;
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
    </div>
  );
}
