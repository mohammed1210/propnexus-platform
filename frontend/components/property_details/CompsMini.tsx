'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchWithRetry } from '@/lib/api';

type Comp = {
  address: string;
  price: number;
  date?: string;
  type?: string;
  distance_km?: number;
};

export default function CompsMini({
  postcode,
  className = '',
}: {
  postcode?: string;
  className?: string;
}) {
  const [sales, setSales] = useState<Comp[] | null>(null);
  const [rents, setRents] = useState<Comp[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const pc = (postcode ?? '').trim();
    if (!pc) {
      setSales(null);
      setRents(null);
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
        setSales(Array.isArray(j?.sales) ? j.sales : []);
        setRents(Array.isArray(j?.rents) ? j.rents : []);
      })
      .catch((e: any) => {
        if (e?.name === 'AbortError') return;
        console.error('CompsMini fetch error', e);
        setErr('Could not load comps');
        setSales([]);
        setRents([]);
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [postcode]);

  const fmtMoney = (v?: number) =>
    typeof v === 'number' ? '£' + v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—';

  const fmtDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
  };

  const fmtDist = (km?: number) =>
    typeof km === 'number' && isFinite(km) ? `${km.toFixed(2)} km` : '';

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
          {/* Sales */}
          <div>
            <p className="font-medium mb-1">Recent Sales</p>
            {sales && sales.length > 0 ? (
              <ul className="text-sm divide-y divide-neutral-200 dark:divide-neutral-800">
                {sales.slice(0, 6).map((c, i) => (
                  <li key={`s-${i}`} className="py-1 flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate" title={c.address}>
                        {c.address}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {c.type ? `${c.type} • ` : ''}
                        {fmtDate(c.date)} {fmtDist(c.distance_km)}
                      </div>
                    </div>
                    <span className="whitespace-nowrap font-medium">{fmtMoney(c.price)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-neutral-500 text-sm">No sales found.</div>
            )}
          </div>

          {/* Rents */}
          <div>
            <p className="font-medium mb-1">Recent Rents</p>
            {rents && rents.length > 0 ? (
              <ul className="text-sm divide-y divide-neutral-200 dark:divide-neutral-800">
                {rents.slice(0, 6).map((c, i) => (
                  <li key={`r-${i}`} className="py-1 flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate" title={c.address}>
                        {c.address}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {c.type ? `${c.type} • ` : ''}
                        {fmtDate(c.date)} {fmtDist(c.distance_km)}
                      </div>
                    </div>
                    <span className="whitespace-nowrap font-medium">{fmtMoney(c.price)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-neutral-500 text-sm">No rents found.</div>
            )}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-neutral-500">Live Land Registry & rent feeds coming next.</p>
    </section>
  );
}
