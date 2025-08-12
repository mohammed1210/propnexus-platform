"use client";

import { useEffect, useMemo, useState } from "react";

type Intel = {
  avgYieldPct?: number;
  avgRent?: number;
  crimeRateIndex?: number;
  ofstedSummary?: string;
  transportSummary?: string;
};

export default function InvestmentInsights({
  price,
  yield_percent,
  roi_percent,
  postcode,
  className = "",
}: {
  price: number;
  yield_percent?: number | null;
  roi_percent?: number | null;
  postcode?: string;
  className?: string;
}) {
  const [intel, setIntel] = useState<Intel | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch the same area intel endpoint to enrich insights (reuses your backend)
  useEffect(() => {
    const backend = (process.env.NEXT_PUBLIC_BACKEND_URL || "").trim();
    const pc = (postcode ?? "").trim().toUpperCase();
    if (!backend || !pc) return;

    let cancelled = false;
    setLoading(true);
    fetch(`${backend}/area-intel/${encodeURIComponent(pc)}`)
      .then((r) => r.json())
      .then((j) => !cancelled && setIntel(j))
      .catch(() => !cancelled && setIntel(null))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [postcode]);

  const notes = useMemo(() => {
    const upsides: string[] = [];
    const risks: string[] = [];
    const actions: string[] = [];

    const y = Number(yield_percent ?? 0);
    const r = Number(roi_percent ?? 0);
    const crime = Number(intel?.crimeRateIndex ?? 50);

    if (y >= 6) upsides.push("Strong gross yield vs typical 4–6% band.");
    if (r >= 12) upsides.push("ROI in investable range (≥12%).");
    if ((intel?.transportSummary || "").match(/(fast|excellent|mins)/i)) upsides.push("Good transport links support demand.");
    if ((intel?.ofstedSummary || "").match(/Good|Outstanding/i)) upsides.push("Nearby schools rated Good/Outstanding.");

    if (crime >= 60) risks.push("Elevated crime index; price/rent sensitivity likely.");
    if (y < 4) risks.push("Below‑average yield; review rent comps.");
    if (r < 8) risks.push("ROI may be thin after costs/voids.");

    actions.push("Request comparables (sales & rents) within 0.5–1.0 mile.");
    actions.push("Confirm boiler age, electrics (EICR), windows & damp survey.");
    actions.push("Model conservative rent and 2–3 week voids.");

    return { upsides, risks, actions };
  }, [yield_percent, roi_percent, intel]);

  return (
    <section className={`rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 ${className}`}>
      <h3 className="text-lg font-semibold mb-2">💡 Investment Insights</h3>
      {loading && <p className="text-sm text-neutral-500 mb-2">Pulling local signals…</p>}

      <div className="space-y-3 text-sm">
        <div>
          <p className="font-medium mb-1">Upsides</p>
          <ul className="list-disc pl-5 space-y-1">
            {notes.upsides.length ? notes.upsides.map((x, i) => <li key={`up-${i}`}>{x}</li>) : <li>Review once more data is loaded.</li>}
          </ul>
        </div>
        <div>
          <p className="font-medium mb-1">Risks</p>
          <ul className="list-disc pl-5 space-y-1">
            {notes.risks.length ? notes.risks.map((x, i) => <li key={`rk-${i}`}>{x}</li>) : <li>No obvious red flags from current inputs.</li>}
          </ul>
        </div>
        <div>
          <p className="font-medium mb-1">Suggested Next Steps</p>
          <ul className="list-disc pl-5 space-y-1">
            {notes.actions.map((x, i) => <li key={`ac-${i}`}>{x}</li>)}
          </ul>
        </div>
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        Generated from property metrics and local intel. Indicative only — validate with your own due diligence.
      </p>
    </section>
  );
}
