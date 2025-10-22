'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchWithRetry } from '@/lib/api';
import Link from 'next/link';
import Image from 'next/image';
import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';

type Deal = {
  id: string;
  property_id: string | null;
  title?: string | null;
  location?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  imageurl?: string | null;
  saved_at?: string | null;
  investment_type?: string | null;
};

export const dynamic = 'force-dynamic';

/** Resolve the FastAPI base URL from public env, with safe fallbacks. */
function getBackendBase(): string {
  const raw =
    (process.env.NEXT_PUBLIC_API_BASE ||
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      '') as string;

  // In the browser, fall back to same-origin if nothing is set
  if (!raw && typeof window !== 'undefined') {
    return window.location.origin.replace(/\/+$/, '');
  }
  // In SSR, default to localhost
  return (raw || 'http://127.0.0.1:8000').replace(/\/+$/, '');
}

export default function SavedDealsPage() {
  const [rows, setRows] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const base = getBackendBase();
        const resp = await fetchWithRetry(`${base}/saved-deals`, { cache: 'no-store' });
        const list = await resp.json();
        const items = Array.isArray(list) ? list : ((list as any)?.data ?? []);
        if (!cancelled) setRows(items);
      } catch (err) {
        console.error('load saved_deals', err);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const removeDeal = async (id: string) => {
    if (!window.confirm('Remove this saved deal?')) return;
    const prev = rows; // optimistic
    setBusyId(id);
    setRows((r) => r.filter((x) => x.id !== id));
    try {
      const base = getBackendBase();
      const resp = await fetchWithRetry(`${base}/saved-deals/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!resp.ok) throw new Error(`Delete failed: ${resp.status}`);
    } catch (err) {
      console.error('delete saved_deal', err);
      setRows(prev); // rollback
      window.alert('Sorry — failed to remove. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const kpis = useMemo(() => {
    const count = rows.length;
    const avgYield = avg(rows.map((d) => num(d.yield_percent)));
    const avgRoi = avg(rows.map((d) => num(d.roi_percent)));
    const totalValue = rows.reduce((s, d) => s + num(d.price), 0);
    return { count, avgYield, avgRoi, totalValue };
  }, [rows]);

  return (
    <Section>
      <div className="flex items-center justify-between gap-4 mb-3">
        <SectionTitle>Saved Deals</SectionTitle>
        {rows.length > 0 && (
          <div className="hidden sm:flex gap-2">
            <Kpi label="Saved" value={kpis.count} />
            <Kpi label="Avg Yield" value={`${kpis.avgYield}%`} />
            <Kpi label="Avg ROI" value={`${kpis.avgRoi}%`} />
            <Kpi label="Total" value={`£${formatGBP(kpis.totalValue)}`} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-4">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-4">No saved deals yet.</div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {rows.map((d) => {
            const removing = busyId === d.id;
            return (
              <li key={d.id} className="card overflow-hidden transition hover:shadow-md">
                <div className="aspect-[16/9] overflow-hidden">
                  <Image
                    src={d.imageurl ?? 'https://placehold.co/640x360?text=PropNexus'}
                    alt={d.title ?? 'Property'}
                    width={640}
                    height={360}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={d.property_id ? `/property/${d.property_id}` : '#'}
                      className="block font-semibold hover:underline leading-snug"
                    >
                      {d.title ?? '—'}
                    </Link>
                    {d.investment_type ? (
                      <span className="shrink-0 text-[11px] px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 tracking-wide">
                        {String(d.investment_type).toUpperCase()}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm opacity-70">{d.location ?? '—'}</div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="font-semibold">£{formatGBP(num(d.price))}</div>
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                        Yield {valOrDash(d.yield_percent)}%
                      </span>
                      <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
                        ROI {valOrDash(d.roi_percent)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-xs opacity-70">
                    {d.bedrooms ?? 0} beds • {d.bathrooms ?? 0} baths
                  </div>
                  <div className="text-xs opacity-60">Saved {formatDate(d.saved_at)}</div>
                  <div className="pt-2 grid grid-cols-3 gap-2">
                    <Link
                      href={d.property_id ? `/property/${d.property_id}` : '#'}
                      className="pnx-pnx-btn pnx-pnx-pnx-btn-outline text-center"
                    >
                      View
                    </Link>
                    <button
                      className="pnx-pnx-btn pnx-pnx-pnx-btn-primary"
                      onClick={() => window.open('mailto:sales@propnexus.ai')}
                      disabled={removing}
                    >
                      Enquire
                    </button>
                    <button
                      className="pnx-pnx-btn pnx-pnx-pnx-btn-outline border-red-300 text-red-700 dark:border-red-800 dark:text-red-300"
                      onClick={() => removeDeal(d.id)}
                      disabled={removing}
                      aria-busy={removing}
                    >
                      {removing ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/* ---------- tiny presentational bits ---------- */
function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide opacity-60">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

/* ---------- helpers ---------- */
function num(n: unknown) {
  return Number(n ?? 0) || 0;
}
function round(n: number) {
  return Number(n.toFixed(2));
}
function avg(list: number[]) {
  const arr = list.filter((x) => Number.isFinite(x));
  return arr.length ? round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
}
function valOrDash(n?: number | null) {
  return n == null ? '–' : round(Number(n));
}
function formatGBP(n: number) {
  return n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
}
function formatDate(s?: string | null) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-GB');
  } catch {
    return '—';
  }
}
