"use client";

import { useEffect, useState } from "react";

type Comp = { address: string; price: number; date?: string; type?: string; distance_km?: number };

export default function CompsMini({
  postcode,
  className = "",
}: { postcode?: string; className?: string }) {
  const [sales, setSales] = useState<Comp[] | null>(null);
  const [rents, setRents] = useState<Comp[] | null>(null);

  useEffect(() => {
    // Placeholder: when backend ready, call /comps/{postcode}
    // For now we just mock a tiny list so UI is live.
    if (!postcode) return;
    setSales([
      { address: "12 Sample Rd", price: 445000, date: "2024-11-18", type: "Terraced", distance_km: 0.4 },
      { address: "8 Mason St", price: 462000, date: "2025-02-07", type: "Semi", distance_km: 0.7 },
      { address: "21 Brook Ave", price: 439000, date: "2025-03-15", type: "Flat", distance_km: 0.9 },
    ]);
    setRents([
      { address: "42 King Way", price: 1450, date: "2025-06-01", type: "2‑bed", distance_km: 0.6 },
      { address: "18 Vale Cl", price: 1525, date: "2025-05-12", type: "2‑bed", distance_km: 0.8 },
      { address: "1 Park Ct", price: 1400, date: "2025-04-20", type: "2‑bed", distance_km: 0.5 },
    ]);
  }, [postcode]);

  return (
    <section className={`rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 ${className}`}>
      <h3 className="text-lg font-semibold mb-3">📈 Nearby Comps (beta)</h3>

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
            {!sales && <li className="text-neutral-500 text-sm">Add postcode to load sales.</li>}
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
            {!rents && <li className="text-neutral-500 text-sm">Add postcode to load rents.</li>}
          </ul>
        </div>
      </div>

      <p className="mt-3 text-xs text-neutral-500">Live Land Registry & rent sources coming next.</p>
    </section>
  );
}
