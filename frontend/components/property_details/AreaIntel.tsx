"use client";

import { useEffect, useState } from "react";

type AreaIntelData = {
  avgYieldPct?: number;
  avgRent?: number;
  crimeRateIndex?: number;
  ofstedSummary?: string;
  transportSummary?: string;
};

interface AreaIntelProps {
  locationLabel?: string;
  postcode?: string; // NEW: postcode for live lookup
  data?: AreaIntelData;
  className?: string;
}

export default function AreaIntel({
  locationLabel,
  postcode,
  data,
  className = "",
}: AreaIntelProps) {
  const [liveData, setLiveData] = useState<AreaIntelData | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch from backend if postcode is provided
  useEffect(() => {
    if (!postcode) return;
    setLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/area-intel/${encodeURIComponent(postcode)}`)
      .then((res) => res.json())
      .then((json) => setLiveData(json))
      .catch((err) => {
        console.error("AreaIntel fetch error:", err);
        setLiveData(null);
      })
      .finally(() => setLoading(false));
  }, [postcode]);

  // Fallback demo values until live data arrives
  const d = {
    avgYieldPct: liveData?.avgYieldPct ?? data?.avgYieldPct ?? 5.8,
    avgRent: liveData?.avgRent ?? data?.avgRent ?? 1350,
    crimeRateIndex: liveData?.crimeRateIndex ?? data?.crimeRateIndex ?? 42,
    ofstedSummary: liveData?.ofstedSummary ?? data?.ofstedSummary ?? "Ofsted Good nearby",
    transportSummary: liveData?.transportSummary ?? data?.transportSummary ?? "Excellent · ~18 mins to centre",
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
        {locationLabel && (
          <span className="text-xs text-neutral-500">{locationLabel}</span>
        )}
      </div>

      {loading ? (
        <div className="p-4 text-sm text-neutral-500">Loading live data…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoCard label="Average Yield" value={`${d.avgYieldPct.toFixed(1)}%`} hint="Local average gross yield" />
            <InfoCard label="Average Rent" value={`£${Math.round(d.avgRent).toLocaleString()}`} hint="Median monthly rent" />
            <InfoCard label="Crime (Index)" value={String(d.crimeRateIndex)} hint="Composite index (0–100). Lower is better." />
            <InfoCard label="Schools" value={d.ofstedSummary} hint="Ofsted ratings summary" />
          </div>
          <div className="mt-3 rounded-md border border-neutral-200 dark:border-neutral-800 p-3 text-sm">
            <div className="mb-1 font-medium">Transport</div>
            <div>{d.transportSummary}</div>
            <div className="mt-2 text-xs text-neutral-500">
              Figures are illustrative for product design. Live feeds coming soon (ONS, Police, Ofsted, TfL/National Rail).
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function InfoCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="mb-1 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
        <span>{label}</span>
        {hint && <span className="cursor-help text-xs text-neutral-500" title={hint}>ⓘ</span>}
      </div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}