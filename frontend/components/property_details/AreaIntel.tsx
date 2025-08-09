"use client";

type AreaIntelData = {
  avgYieldPct?: number;       // e.g. 5.8
  avgRent?: number;           // e.g. 1350 (monthly)
  crimeRateIndex?: number;    // 0–100 (lower is better) – placeholder index
  ofstedSummary?: string;     // e.g. "3 schools rated Good within 1 mile"
  transportSummary?: string;  // e.g. "Excellent · ~18 mins to centre"
};

interface AreaIntelProps {
  locationLabel?: string;
  data?: AreaIntelData;
  className?: string;
}

/**
 * 📍 AreaIntel
 * Additive upgrade: bordered cards, tooltip hints, and an "illustrative figures" disclaimer.
 * Safe to replace the existing file. Default export name unchanged to avoid breaking imports.
 */
export default function AreaIntel({
  locationLabel,
  data,
  className = "",
}: AreaIntelProps) {
  // Fallback demo values until live feeds (ONS, Police, Ofsted, TfL/National Rail) are connected.
  const d = {
    avgYieldPct: data?.avgYieldPct ?? 5.8,
    avgRent: data?.avgRent ?? 1350,
    crimeRateIndex: data?.crimeRateIndex ?? 42,
    ofstedSummary: data?.ofstedSummary ?? "Ofsted Good nearby",
    transportSummary: data?.transportSummary ?? "Excellent · ~18 mins to centre",
  };

  return (
    <section
      className={[
        "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4",
        className,
      ].join(" ")}
      aria-labelledby="area-intelligence"
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <h3 id="area-intelligence" className="text-lg font-semibold">
          📍 Area Intelligence
        </h3>
        {locationLabel && (
          <span className="text-xs text-neutral-500">{locationLabel}</span>
        )}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoCard
          label="Average Yield"
          value={`${Number(d.avgYieldPct).toFixed(1)}%`}
          hint="Local average gross yield (illustrative)."
        />
        <InfoCard
          label="Average Rent"
          value={`£${Math.round(Number(d.avgRent)).toLocaleString()}`}
          hint="Median monthly rent for similar properties (illustrative)."
        />
        <InfoCard
          label="Crime (Index)"
          value={String(d.crimeRateIndex)}
          hint="Composite index (0–100). Lower is better. Live feed coming soon."
        />
        <InfoCard
          label="Schools"
          value={d.ofstedSummary}
          hint="Ofsted ratings summary (illustrative). Live feed coming soon."
        />
      </div>

      {/* Transport + disclaimer */}
      <div className="mt-3 rounded-md border border-neutral-200 dark:border-neutral-800 p-3 text-sm">
        <div className="mb-1 font-medium">Transport</div>
        <div>{d.transportSummary}</div>
        <div className="mt-2 text-xs text-neutral-500">
          Figures are illustrative for product design. Live feeds coming soon
          (ONS, Police, Ofsted, TfL/National Rail).
        </div>
      </div>
    </section>
  );
}

/* ---------- Small internal card component ---------- */
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
          <span className="cursor-help text-xs text-neutral-500" title={hint} aria-label={`${label} info`}>
            ⓘ
          </span>
        )}
      </div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}