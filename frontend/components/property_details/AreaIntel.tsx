'use client';

import { useEffect, useState } from 'react';
import { fetchWithRetry } from '@/lib/api';

type AreaIntelData = {
  avgYieldPct?: number;
  avgRent?: number;
  crimeRateIndex?: number;
  ofstedSummary?: string;
  transportSummary?: string;
};

interface AreaIntelProps {
  locationLabel?: string;
  postcode?: string;
  data?: AreaIntelData;
  className?: string;
}

export default function AreaIntel({
  locationLabel,
  postcode,
  data,
  className = '',
}: AreaIntelProps) {
  const [liveData, setLiveData] = useState<AreaIntelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const backend = (process.env.NEXT_PUBLIC_BACKEND_URL || '').trim();
    const pc = (postcode ?? '').trim().toUpperCase();
    const validPostcode = pc.length >= 3;

    if (!backend || !validPostcode) {
      setLoading(false);
      setErr(null);
      setLiveData(null);
      return;
    }

    let cancelled = false;
    const ctrl = new AbortController();
    setLoading(true);
    setErr(null);

    const cacheKey = `area-intel:${pc}`;

    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null;
      if (cached) {
        const parsed = JSON.parse(cached);
        setLiveData(parsed);
        setLoading(false);
        return () => ctrl.abort();
      }
    } catch {
      /* ignore cache parse */
    }

    fetchWithRetry(`${backend}/area-intel/${encodeURIComponent(pc)}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setLiveData(json);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(json));
        } catch {}
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('AreaIntel fetch error:', e);
        setLiveData(null);
        setErr('Couldn’t load live area data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [postcode]);

  // Merge: live → provided → sensible demo defaults
  const d = {
    avgYieldPct: liveData?.avgYieldPct ?? data?.avgYieldPct ?? 5.8,
    avgRent: liveData?.avgRent ?? data?.avgRent ?? 1350,
    crimeRateIndex: liveData?.crimeRateIndex ?? data?.crimeRateIndex ?? 42,
    ofstedSummary: liveData?.ofstedSummary ?? data?.ofstedSummary ?? 'Ofsted Good nearby',
    transportSummary:
      liveData?.transportSummary ?? data?.transportSummary ?? 'Excellent · ~18 mins to centre',
  };

  return (
    <section
      className={`rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 ${className}`}
      aria-labelledby="area-intelligence"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 id="area-intelligence" className="text-lg font-semibold">
          📍 Area Intelligence
        </h3>
        {locationLabel && <span className="text-xs text-neutral-500">{locationLabel}</span>}
      </div>

      {loading ? (
        <div className="p-4">
          <div className="h-4 w-1/3 bg-neutral-200 dark:bg-neutral-800 rounded mb-2 animate-pulse" />
          <div className="h-4 w-1/2 bg-neutral-200 dark:bg-neutral-800 rounded mb-2 animate-pulse" />
          <div className="h-4 w-2/3 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        </div>
      ) : (
        <>
          {err && (
            <div className="mb-3 text-xs text-amber-600">
              {err} Showing illustrative figures instead.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoCard
              label="Average Yield"
              value={`${Number(d.avgYieldPct).toFixed(1)}%`}
              hint="Local average gross yield"
            />
            <InfoCard
              label="Average Rent"
              value={`£${Math.round(Number(d.avgRent)).toLocaleString()}`}
              hint="Median monthly rent"
            />
            <InfoCard
              label="Crime (Index)"
              value={String(d.crimeRateIndex)}
              hint="Composite index (0–100). Lower is better."
            />
            <InfoCard label="Schools" value={d.ofstedSummary} hint="Ofsted ratings summary" />
          </div>

          <div className="mt-3 rounded-md border border-neutral-200 dark:border-neutral-800 p-3 text-sm">
            <div className="mb-1 font-medium">Transport</div>
            <div>{d.transportSummary}</div>
            <div className="mt-2 text-xs text-neutral-500">
              Figures are illustrative for product design. Live feeds coming soon (ONS, Police,
              Ofsted, TfL/National Rail).
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function InfoCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="mb-1 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
        <span>{label}</span>
        {hint && (
          <span className="cursor-help text-xs text-neutral-500" title={hint}>
            ⓘ
          </span>
        )}
      </div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
