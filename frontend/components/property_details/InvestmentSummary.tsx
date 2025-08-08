'use client';

import { useEffect, useMemo, useState } from 'react';
import { Property } from '@/types';

interface InvestmentSummaryProps {
  property: Property;
}

export default function InvestmentSummary({ property }: InvestmentSummaryProps) {
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    if (!property) return;

    // If the backend base isn’t configured, don’t try to call it.
    if (!BACKEND_BASE) {
      console.warn('NEXT_PUBLIC_API_URL is not set – showing local summary.');
      setSummary(
        `This opportunity is in ${property.location || 'the selected area'}, priced at £${
          Number(property.price || 0).toLocaleString()
        }, offering a yield of ${property.yield_percent ?? 'N/A'}% and an ROI of ${
          property.roi_percent ?? 'N/A'
        }%.`
      );
      setLoading(false);
      return;
    }

    const fetchSummary = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${BACKEND_BASE}/generate-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: property.title,
            location: property.location,
            price: property.price,
            yield_percent: property.yield_percent,
            roi_percent: property.roi_percent,
            investmentType: property.investmentType || '',
            propertyType: property.propertyType || '',
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Summary API ${res.status}: ${text}`);
        }

        const data = await res.json();
        setSummary(
          typeof data === 'string' ? data : data?.summary || 'No summary available.'
        );
      } catch (err: any) {
        console.error('Fetch summary error:', err);
        setError('Could not generate AI summary.');
        setSummary(
          `Price £${Number(property.price || 0).toLocaleString()}, yield ${
            property.yield_percent ?? 'N/A'
          }%, ROI ${property.roi_percent ?? 'N/A'}%.`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [property, BACKEND_BASE]);

  // --- lightweight scoring just for visuals (safe if values missing) ---
  const { yieldScore, roiScore } = useMemo(() => {
    const y = typeof property.yield_percent === 'number' ? property.yield_percent : null;
    const r = typeof property.roi_percent === 'number' ? property.roi_percent : null;

    // Map to 0–100 (cap to avoid silly bars)
    // yield: 0–12% ≈ 0–100
    const yScore = y == null ? null : Math.max(0, Math.min(100, (y / 12) * 100));
    // roi: 0–25% ≈ 0–100
    const rScore = r == null ? null : Math.max(0, Math.min(100, (r / 25) * 100));
    return { yieldScore: yScore, roiScore: rScore };
  }, [property.yield_percent, property.roi_percent]);

  return (
    <div>
      <h3 className="text-xl font-semibold mb-2">📈 Investment Summary</h3>

      {loading ? (
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 rounded mb-2" />
          <div className="h-4 bg-slate-200 rounded mb-2 w-5/6" />
          <div className="h-4 bg-slate-200 rounded mb-4 w-4/6" />
        </div>
      ) : (
        <>
          {error ? (
            <p className="text-amber-700 mb-2">{error}</p>
          ) : null}
          <p className="leading-6 text-slate-700 mb-4">{summary}</p>
        </>
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
