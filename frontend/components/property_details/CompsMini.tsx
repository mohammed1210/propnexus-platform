'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchWithRetry } from '@/lib/api';

type CompsPayload = {
  source?: 'db';
  postcode?: string;
  match_level?: 'postcode' | 'outward' | 'none';
  count?: number;
  median_price?: number | null;
  median_rent?: number | null;
};

export default function CompsMini({
  postcode,
  className = '',
}: {
  postcode?: string;
  className?: string;
}) {
  const [comps, setComps] = useState<CompsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const pc = (postcode ?? '').trim();
    if (!pc) {
      setComps(null);
      setErr(null);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }

    // Abort any in-flight request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setErr(null);

    fetchWithRetry(`/api/comps/${encodeURIComponent(pc)}`, {
      cache: 'no-store',
      signal: ctrl.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        setComps(j as CompsPayload);
      })
      .catch((e: any) => {
        if (e?.name === 'AbortError') return;
        console.error('CompsMini fetch error', e);
        setErr('Could not load comps');
        setComps(null);
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [postcode]);

  const fmtMoney = (v?: number | null) =>
    typeof v === 'number' && isFinite(v) && v > 0
      ? '£' + v.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : '—';

  return (
    <section
      className={`rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 ${className}`}
    >
      <h3 className="text-lg font-semibold mb-3">
        📈 Nearby Comps <span className="text-xs text-neutral-500">(beta)</span>
      </h3>

      {postcode ? (
        <p className="text-xs text-neutral-500 -mt-2 mb-3">
          for <span className="font-mono">{postcode.toUpperCase()}</span>
        </p>
      ) : (
        <p className="text-sm text-neutral-500 -mt-1 mb-3">Add a postcode to load comps.</p>
      )}

      {loading && (
        <div className="grid sm:grid-cols-2 gap-4">
          {[0, 1].map((col) => (
            <div key={col} className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse"
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {err && !loading && <p className="text-sm text-red-600 mb-2">{err}</p>}

      {!loading && !err && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
            <div className="text-sm text-neutral-600 dark:text-neutral-300 mb-1">Median sale price</div>
            <div className="text-base font-semibold">{fmtMoney(comps?.median_price ?? null)}</div>
            <div className="text-xs text-neutral-500 mt-1">
              {typeof comps?.count === 'number' ? `${comps.count} sample${comps.count === 1 ? '' : 's'}` : ''}
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
            <div className="text-sm text-neutral-600 dark:text-neutral-300 mb-1">Median rent/mo</div>
            <div className="text-base font-semibold">{fmtMoney(comps?.median_rent ?? null)}</div>
            <div className="text-xs text-neutral-500 mt-1">
              {comps?.match_level ? `match: ${comps.match_level}` : ''}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
