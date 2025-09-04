'use client';

/* ──────────────────────────────────────────────────────────────────
   InvestmentInsights
   - Generates Upsides / Risks / Next Steps from inputs
   - Fetches nearby comps by postcode (debounce + abort-safe)
   - Optional compact AI Score breakdown (aiOverall + aiItems)
   - Uses shared <Button> for refresh
   - hideTitle prop to suppress the internal heading
   ────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '@/components/ui/Button';

type RentComp = { monthly_rent?: number | string };
type SalesComp = Record<string, unknown>;

type CompsPayload = {
  postcode?: string;
  sales?: SalesComp[];
  rents?: RentComp[];
  note?: string;
  error?: string;
};

type AIItem = { key?: string; label: string; value: number; hint?: string };

export default function InvestmentInsights({
  className = '',
  price,
  yield_percent,
  roi_percent,
  postcode,
  compsHref = '#comps',
  aiOverall,
  aiItems,
  hideTitle = false,
}: {
  className?: string;
  price: number;
  yield_percent?: number;
  roi_percent?: number;
  postcode?: string;
  compsHref?: string;
  aiOverall?: number;
  aiItems?: AIItem[];
  hideTitle?: boolean;
}) {
  const [comps, setComps] = useState<CompsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Debounce + abort for comps fetch
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postcode]);

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

  // Heuristics
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
      {!hideTitle && <h3 className="text-lg font-semibold mb-2">💡 Investment Insights</h3>}

      {typeof aiOverall === 'number' && Array.isArray(aiItems) && (
        <details className="mb-3 group">
          <summary className="cursor-pointer select-none text-sm font-medium list-none flex items-center gap-2">
            <span className="inline-block">🤖 AI Score Breakdown</span>
            <span className="text-xs text-neutral-500">(indicative)</span>
          </summary>
          <div className="mt-2 text-sm">
            <div className="mb-2">
              Overall: <strong>{aiOverall}</strong>
            </div>
            <ul className="space-y-1">
              {aiItems.map((it, idx) => (
                <li key={it.key ?? idx}>
                  {it.label}
                  <span className="ml-1 font-semibold">{it.value}%</span>
                  {it.hint ? <span className="ml-1 text-neutral-500">— {it.hint}</span> : null}
                </li>
              ))}
            </ul>
            <div className="text-xs text-neutral-500 mt-2">
              Based on yield, ROI and area/risk proxies. Validate with your own numbers.
            </div>
          </div>
        </details>
      )}

      {/* Upsides / Risks / Next steps */}
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

      {/* Nearby Comps */}
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

          <Button
            variant="secondary"
            size="sm"
            onClick={() => postcode && fetchComps(postcode)}
            disabled={!postcode || loading}
            aria-disabled={!postcode || loading}
            loading={loading}
          >
            ↻ Refresh
          </Button>
        </div>

        {!postcode && <div className="text-sm text-neutral-500 mt-2">Add postcode to load sales & rents.</div>}

        {postcode && loading && (
          <div className="text-sm text-neutral-500 mt-2" aria-live="polite">
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

            {lastUpdated && (
              <div className="text-[10px] text-neutral-500 mt-2">Last updated {lastUpdated.toLocaleTimeString()}</div>
            )}
          </div>
        )}

        <div className="text-xs text-neutral-500 mt-3">Live Land Registry & rent sources coming next.</div>
      </div>
    </section>
  );
}