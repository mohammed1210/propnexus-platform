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
}: {
  className?: string;
  price: number;
  yield_percent?: number;
  roi_percent?: number;
  postcode?: string;
}) {
  const [comps, setComps] = useState<CompsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Debounce + abort setup for comps fetch
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    // reset state when postcode is missing
    if (!postcode) {
      setComps(null);
      setFetchError(null);
      setLoading(false);
      return;
    }

    // debounce typing by 350ms
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      // cancel any in-flight request
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoading(true);
      setFetchError(null);

      try {
        const res = await fetch(`/api/comps/${encodeURIComponent(postcode)}`, {
          cache: 'no-store',
          signal: ctrl.signal,
        });

        if (!res.ok) {
          const msg = `HTTP ${res.status}`;
          setFetchError(msg);
          setComps(null);
        } else {
          const data: CompsPayload = await res.json();
          if (data?.error) {
            setFetchError(data.error);
            setComps(null);
          } else {
            setComps(data);
          }
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setFetchError('Failed to load comps.');
          setComps(null);
        }
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [postcode]);

  // ===== Derived signals
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

  // ===== Heuristics
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
    <section
      className={`rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 ${className}`}
    >
      <h3 className="text-lg font-semibold mb-2">💡 Investment Insights</h3>

      <div className="mb-2">
        <div className="font-medium">Upsides</div>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          {upsides.map((u, i) => (
            <li key={`up-${i}`}>{u}</li>
          ))}
        </ul>
      </div>

      <div className="mb-2">
        <div className="font-medium">Risks</div>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          {risks.map((r, i) => (
            <li key={`rk-${i}`}>{r}</li>
          ))}
        </ul>
      </div>

      <div className="mb-3">
        <div className="font-medium">Suggested Next Steps</div>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          {nextSteps.map((n, i) => (
            <li key={`ns-${i}`}>{n}</li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-neutral-500 mb-3">
        Generated from property metrics and local intel. Indicative only — validate with your own due diligence.
      </p>

      <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
        <div className="font-medium">📉 Nearby Comps (beta)</div>

        {/* State: no postcode */}
        {!postcode && (
          <div className="text-sm text-neutral-500 mt-1">Add postcode to load sales & rents.</div>
        )}

        {/* State: loading */}
        {postcode && loading && (
          <div className="text-sm text-neutral-500 mt-1">
            <span className="inline-block h-3 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mr-2" />
            Loading {postcode}…
          </div>
        )}

        {/* State: error */}
        {postcode && !loading && fetchError && (
          <div className="text-sm text-red-600 mt-1">Couldn’t load comps: {fetchError}</div>
        )}

        {/* State: data */}
        {postcode && !loading && !fetchError && (
          <div className="text-sm mt-1">
            <div className="flex flex-wrap gap-4">
              <span>
                Recent Sales: <strong>{salesCount}</strong>
              </span>
              <span>
                Recent Rents: <strong>{rentsCount}</strong>
              </span>
              {avgRent ? (
                <span>
                  Avg Rent: <strong>£{avgRent.toLocaleString()}</strong>
                </span>
              ) : null}
            </div>

            {!salesCount && !rentsCount && (
              <div className="text-neutral-500 mt-1">No comps found for this postcode.</div>
            )}
          </div>
        )}

        <div className="text-xs text-neutral-500 mt-2">
          Live Land Registry & rent sources coming next.
        </div>
      </div>
    </section>
  );
}
