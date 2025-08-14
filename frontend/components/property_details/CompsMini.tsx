"use client";

import { useEffect, useState } from "react";

type Comp = { address: string; price: number; date?: string; type?: string; distance_km?: number };

export default function CompsMini({
  postcode,
  className = "",
}: { postcode?: string; className?: string }) {
  const [sales, setSales] = useState<Comp[] | null>(null);
  const [rents, setRents] = useState<Comp[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const pc = (postcode ?? "").trim();
    if (!pc) { setSales(null); setRents(null); return; }

    let cancelled = false;
    setLoading(true);
    setErr(null);

    fetch(`/api/comps/${encodeURIComponent(pc)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(j => {
        if (cancelled) return;
        setSales(j?.sales ?? null);
        setRents(j?.rents ?? null);
      })
      .catch(e => {
        console.error("CompsMini fetch error", e);
        if (!cancelled) setErr("Could not load comps");
      })
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [postcode]);

  return (
    <section className={`rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 ${className}`}>
      <h3 className="text-lg font-semibold mb-3">📈 Nearby Comps (beta)</h3>

      {loading && <p className="text-sm text-neutral-500 mb-2">Fetching comps…</p>}
      {err && <p className="text-sm text-red-600 mb-2">{err}</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="font-medium mb-1">Recent Sales</p>
          <ul className="text-sm space-y-1">
            {(sales ?? []).map((c, i) => (
              <li key={`s-${i}`} className="flex justify-between">
                <span className="truncate" title={c.address}>{c.address}</span>
                <span>£{c.price.toLocaleString()}</span>
              </li>
            ))}
            {!sales && !loading && <li className="text-neutral-500 text-sm">Add postcode to load sales.</li>}
          </ul>
        </div>

        <div>
          <p className="font-medium mb-1">Recent Rents</p>
          <ul className="text-sm space-y-1">
            {(rents ?? []).map((c, i) => (
              <li key={`r-${i}`} className="flex justify-between">
                <span className="truncate" title={c.address}>{c.address}</span>
                <span>£{c.price.toLocaleString()}</span>
              </li>
            ))}
            {!rents && !loading && <li className="text-neutral-500 text-sm">Add postcode to load rents.</li>}
          </ul>
        </div>
      </div>

      <p className="mt-3 text-xs text-neutral-500">Live Land Registry & rent sources coming next.</p>
    </section>
  );
}
