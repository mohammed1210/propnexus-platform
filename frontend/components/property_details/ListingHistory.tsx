'use client';

import { fmtGBP } from '@/components/property_details/OfferIntelligence';

type HistoryProperty = {
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  initial_price?: number | null;
  previous_price?: number | null;
  last_price_change_at?: string | null;
  price_change_count?: number | null;
  price_history?: Array<{ old_price?: number; new_price?: number; changed_at?: string; direction?: string }> | null;
  price?: number | null;
  created_at?: string | null;
};

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-GB') : '—';
}

function daysBetween(start?: string | null, end?: string | null): number | null {
  if (!start) return null;
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  return Math.max(0, Math.round((e - s) / 86400000));
}

export default function ListingHistory({ property }: { property: HistoryProperty }) {
  const history = Array.isArray(property.price_history) ? property.price_history : [];
  const firstSeen = property.first_seen_at ?? property.created_at ?? null;
  const days = daysBetween(firstSeen, property.last_seen_at);
  const initial = property.initial_price ?? property.price ?? null;
  const current = property.price ?? null;
  const latest = history[history.length - 1];
  const totalReduction = initial && current && initial > current ? ((initial - current) / initial) * 100 : null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/40 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Listing history</div>
          <h3 className="mt-1 text-lg font-black text-slate-950 dark:text-white">Price changes and days tracked</h3>
        </div>
        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold dark:border-slate-700">{days ?? '—'} days tracked</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50"><div className="text-xs text-slate-500">First seen</div><div className="font-bold">{fmtDate(firstSeen)}</div></div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50"><div className="text-xs text-slate-500">Initial price</div><div className="font-bold">{fmtGBP(initial)}</div></div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50"><div className="text-xs text-slate-500">Current price</div><div className="font-bold">{fmtGBP(current)}</div></div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50"><div className="text-xs text-slate-500">Total reduction</div><div className="font-bold">{totalReduction ? `${totalReduction.toFixed(1)}%` : '—'}</div></div>
      </div>
      {history.length === 0 ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">No verified price movement recorded since PropNexus began tracking this listing.</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {history.slice(-6).reverse().map((item, idx) => (
            <li key={`${item.changed_at}-${idx}`} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
              <span className="font-bold capitalize">{item.direction || 'change'}</span> {fmtGBP(item.old_price)} → {fmtGBP(item.new_price)} <span className="text-slate-500">on {fmtDate(item.changed_at)}</span>
            </li>
          ))}
        </ol>
      )}
      {latest ? <p className="mt-3 text-xs text-slate-500">Latest movement: {fmtGBP(latest.old_price)} → {fmtGBP(latest.new_price)}.</p> : null}
    </div>
  );
}
