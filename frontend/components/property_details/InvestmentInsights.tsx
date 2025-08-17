"use client";

import { useEffect, useMemo, useState } from "react";

type CompsPayload = {
  postcode?: string;
  sales?: any[];
  rents?: { monthly_rent?: number }[];
  note?: string;
};

export default function InvestmentInsights({
  className = "",
  price,
  yield_percent,
  roi_percent,
  postcode,
}: {
  className?: string;
  price: number;
  yield_percent?: number;
  roi_percent?: number;
  postcode?: string;
}) {
  const [comps, setComps] = useState<CompsPayload | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch nearby comps if we have a postcode
  useEffect(() => {
    let cancelled = false;
    if (!postcode) {
      setComps(null);
      return;
    }
    setLoading(true);
    fetch(`/api/comps/${encodeURIComponent(postcode)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(data => { if (!cancelled) setComps(data); })
      .catch(() => { if (!cancelled) setComps(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [postcode]);

  // Basic derived signals
  const avgRent = useMemo(() => {
    const rs = comps?.rents?.map(r => Number(r.monthly_rent)).filter(Boolean) ?? [];
    if (!rs.length) return undefined;
    return Math.round(rs.reduce((a, b) => a + b, 0) / rs.length);
  }, [comps?.rents]);

  const salesCount = comps?.sales?.length ?? 0;
  const rentsCount = comps?.rents?.length ?? 0;

  // Text heuristics (tweak thresholds as you like)
  const upsides: string[] = [];
  const risks: string[] = [];
  const nextSteps: string[] = [
    "Request comparables (sales & rents) within 0.5–1.0 mile.",
    "Confirm boiler age, electrics (EICR), windows & damp survey.",
    "Model conservative rent and 2–3 week voids.",
  ];

  if ((yield_percent ?? 0) >= 6) upsides.push("Strong gross yield vs typical 4–6% band.");
  if ((roi_percent ?? 0) >= 12) upsides.push("Healthy ROI potential on current assumptions.");
  if (avgRent) upsides.push(`Local median rent around £${avgRent.toLocaleString()}.`);

  if ((yield_percent ?? 0) < 4) risks.push("Below-average gross yield—pressure-test rent or price.");
  if ((roi_percent ?? 0) < 8) risks.push("ROI looks light—review refurb scope and exit options.");
  if (salesCount + rentsCount < 4 && postcode) risks.push("Limited nearby comps—validate pricing with agents.");

  if (!upsides.length) upsides.push("No obvious positives from current inputs.");
  if (!risks.length) risks.push("No obvious red flags from current inputs.");

  return (
    <section className={`rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 ${className}`}>
      <h3 className="text-lg font-semibold mb-2">💡 Investment Insights</h3>

      <div className="mb-2">
        <div className="font-medium">Upsides</div>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          {upsides.map((u, i) => <li key={`up-${i}`}>{u}</li>)}
        </ul>
      </div>

      <div className="mb-2">
        <div className="font-medium">Risks</div>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          {risks.map((r, i) => <li key={`rk-${i}`}>{r}</li>)}
        </ul>
      </div>

      <div className="mb-3">
        <div className="font-medium">Suggested Next Steps</div>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          {nextSteps.map((n, i) => <li key={`ns-${i}`}>{n}</li>)}
        </ul>
      </div>

      <p className="text-xs text-neutral-500 mb-3">
        Generated from property metrics and local intel. Indicative only — validate with your own due diligence.
      </p>

      <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
        <div className="font-medium">📉 Nearby Comps (beta)</div>
        {postcode ? (
          loading ? (
            <div className="text-sm text-neutral-500 mt-1">Loading {postcode}…</div>
          ) : (
            <div className="text-sm mt-1">
              <div className="flex gap-4">
                <span>Recent Sales: <strong>{salesCount}</strong></span>
                <span>Recent Rents: <strong>{rentsCount}</strong></span>
                {avgRent ? <span>Avg Rent: <strong>£{avgRent.toLocaleString()}</strong></span> : null}
              </div>
              {!salesCount && !rentsCount && (
                <div className="text-neutral-500 mt-1">Add postcode to load sales & rents.</div>
              )}
            </div>
          )
        ) : (
          <div className="text-sm text-neutral-500 mt-1">Add postcode to load sales & rents.</div>
        )}
        <div className="text-xs text-neutral-500 mt-2">Live Land Registry & rent sources coming next.</div>
      </div>
    </section>
  );
}
