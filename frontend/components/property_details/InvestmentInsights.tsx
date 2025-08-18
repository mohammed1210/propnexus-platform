// frontend/components/property_details/InvestmentInsights.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type RentComp = { monthly_rent?: number | string };
type SalesComp = Record<string, unknown>;

type CompsPayload = {
  postcode?: string;
  sales?: SalesComp[];
  rents?: RentComp[];
  note?: string;
  error?: string;
};

export default function InvestmentInsights({
  className = '',
  price,
  yield_percent,
  roi_percent,
  postcode,
  compsHref = '#comps',
}: {
  className?: string;
  price: number;
  yield_percent?: number;
  roi_percent?: number;
  postcode?: string;
  compsHref?: string;
}) {
  const [comps, setComps] = useState<CompsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showExplain, setShowExplain] = useState(false);

  // === Debounced/abortable fetch for comps ===
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  const fetchComps = async (pc: string, opts?: { signal?: AbortSignal }) => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/comps/${encodeURIComponent(pc)}`, {
        cache: 'no-store',
        signal: opts?.signal,
      });
      if (!res.ok) {
        setFetchError(`HTTP ${res.status}`);
        setComps(null);
        return;
      }
      const data: CompsPayload = await res.json();
      if (data?.error) {
        setFetchError(data.error);
        setComps(null);
        return;
      }
      setComps(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setFetchError('Failed to load comps.');
        setComps(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!postcode) {
      setComps(null);
      setFetchError(null);
      setLoading(false);
      setLastUpdated(null);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      fetchComps(postcode, { signal: ctrl.signal });
    }, 350);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [postcode]); // eslint-disable-line react-hooks/exhaustive-deps

  // === Derived comps signals ===
  const avgRent = useMemo(() => {
    const rs =
      comps?.rents
        ?.map((r) => Number(r?.monthly_rent ?? 0))
        .filter((n) => Number.isFinite(n) && n > 0) ?? [];
    if (!rs.length) return undefined;
    return Math.round(rs.reduce((a, b) => a + b, 0) / rs.length);
  }, [comps?.rents]);

  const salesCount = comps?.sales?.length ?? 0;
  const rentsCount = comps?.rents?.length ?? 0;

  // === AI Score Breakdown (simple, transparent heuristics for now) ===
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  const scoreYield = clamp((yield_percent ?? 0) * 10);     // 7.2% → 72
  const scoreROI = clamp((roi_percent ?? 0) * 5);          // 14% → 70
  const scoreDemand = 68;                                   // placeholder until live feeds
  const scoreRisk = 60;                                     // placeholder: higher = safer
  const overall = Math.round([scoreYield, scoreROI, scoreDemand, scoreRisk].reduce((a, b) => a + b, 0) / 4);

  const scoreItems = [
    { key: 'yield', label: 'Yield Strength', value: scoreYield, hint: 'Estimated gross yield vs local averages.' },
    { key: 'roi', label: 'ROI Potential', value: scoreROI, hint: 'Projected ROI given refurb & exit assumptions.' },
    { key: 'demand', label: 'Area Demand', value: scoreDemand, hint: 'Rental demand & stock turnover (illustrative).' },
    { key: 'risk', label: 'Risk Adjusted', value: scoreRisk, hint: 'Higher = lower perceived risk (illustrative).' },
  ];

  // === Insights heuristics ===
  const upsides: string[] = [];
  const risks: string[] = [];
  const nextSteps: string[] = [
    'Request comparables (sales & rents) within 0.5–1.0 mile.',
    'Confirm boiler age, electrics (EICR), windows & damp survey.',
    'Model conservative rent and 2–3 week voids.',
  ];

  if ((yield_percent ?? 0) >= 6) upsides.push('Strong gross yield vs typical 4–6% band.');
  if ((roi_percent ?? 0) >= 12) upsides.push('Healthy ROI potential on current assumptions.');
  if (avgRent) upsides.push(`Local median rent around £${avgRent.toLocaleString()}.`);

  if ((yield_percent ?? 0) < 4) risks.push('Below-average gross yield — pressure-test rent or price.');
  if ((roi_percent ?? 0) < 8) risks.push('ROI looks light — review refurb scope and exit options.');
  if (salesCount + rentsCount < 4 && postcode)
    risks.push('Limited nearby comps — validate pricing with local agents.');

  if (!upsides.length) upsides.push('No obvious positives from current inputs.');
  if (!risks.length) risks.push('No obvious red flags from current inputs.');

  return (
    <section className={`rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 ${className}`}>
      <h3 className="text-lg font-semibold mb-2">💡 Investment Insights</h3>

      {/* === AI Score Breakdown === */}
      <div className="mb-4 rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">🧠 AI Score Breakdown</div>
          <button
            type="button"
            className="text-xs underline text-blue-600 hover:text-blue-700"
            onClick={() => setShowExplain(true)}
          >
            What do these mean?
          </button>
        </div>

        <div className="text-sm mb-2">
          Overall: <span className="font-semibold">{overall}</span>
        </div>

        <div className="space-y-2">
          {scoreItems.map((s) => (
            <div key={s.key} className="text-sm">
              <div className="flex justify-between mb-1">
                <span>{s.label}</span>
                <span className="font-medium">{s.value}%</span>
              </div>
              <div className="h-2 w-full bg-neutral-200 dark:bg-neutral-800 rounded">
                <div
                  className="h-2 rounded"
                  style={{
                    width: `${s.value}%`,
                    background:
                      'linear-gradient(90deg, rgba(59,130,246,1) 0%, rgba(34,197,94,1) 100%)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* === Upsides / Risks / Next Steps === */}
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

      {/* === Nearby Comps === */}
      <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="font-medium">📉 Nearby Comps</div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
              beta
            </span>
            <a href={compsHref} className="text-xs underline text-blue-600 hover:text-blue-700">
              View comps
            </a>
          </div>

          <button
            type="button"
            className="text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            onClick={() => postcode && fetchComps(postcode)}
            disabled={!postcode || loading}
            aria-disabled={!postcode || loading}
            title="Refresh comps"
          >
            ↻ Refresh
          </button>
        </div>

        {!postcode && (
          <div className="text-sm text-neutral-500 mt-2">Add postcode to load sales & rents.</div>
        )}

        {postcode && loading && (
          <div className="text-sm text-neutral-500 mt-2">
            <span className="inline-block h-3 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mr-2" />
            Loading {postcode}…
          </div>
        )}

        {postcode && !loading && fetchError && (
          <div className="text-sm text-red-600 mt-2">Couldn’t load comps: {fetchError}</div>
        )}

        {postcode && !loading && !fetchError && (
          <div className="text-sm mt-2">
            <div className="flex flex-wrap gap-4">
              <span>Recent Sales: <strong>{salesCount}</strong></span>
              <span>Recent Rents: <strong>{rentsCount}</strong></span>
              {avgRent ? <span>Avg Rent: <strong>£{avgRent.toLocaleString()}</strong></span> : null}
            </div>

            {!salesCount && !rentsCount && (
              <div className="text-neutral-500 mt-1">No comps found for this postcode.</div>
            )}

            {lastUpdated && (
              <div className="text-[10px] text-neutral-500 mt-2">
                Last updated {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-neutral-500 mt-3">
          Live Land Registry & rent sources coming next.
        </div>
      </div>

      {/* === Explain modal === */}
      {showExplain && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowExplain(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative max-w-lg w-[92%] rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">How we calculate these scores</h4>
              <button
                className="text-sm px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700"
                onClick={() => setShowExplain(false)}
              >
                Close
              </button>
            </div>
            <ul className="list-disc ml-5 space-y-1 text-sm">
              <li><strong>Yield Strength</strong>: gross yield vs local typical ranges.</li>
              <li><strong>ROI Potential</strong>: projected ROI given refurb & exit assumptions.</li>
              <li><strong>Area Demand</strong>: rental demand & turnover (illustrative placeholder).</li>
              <li><strong>Risk Adjusted</strong>: lighter risk → higher score (illustrative placeholder).</li>
            </ul>
            <p className="text-xs text-neutral-500 mt-3">
              Overall score is an average of the above. These are indicative only — always validate
              with your own numbers and due diligence.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
