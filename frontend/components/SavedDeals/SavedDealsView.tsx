'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import { normalizeProperty } from '@/lib/normalizeProperty';

type Property = {
  id?: string;
  uuid?: string;

  title?: string | null;
  location?: string | null;
  postcode?: string | null;

  price?: number | string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;

  yield_percent?: number | null;
  roi_percent?: number | null;

  monthly_rent_estimate?: number | null;
  rent_estimate?: number | null;

  ai_score?: number | null;

  imageurl?: string | null;
  image_url?: string | null;
  image?: string | null;

  source?: string | null;
  area_key?: string | null;
  area?: string | null;
};

type SavedDeal = {
  id: string;
  property_id: string;
  created_at?: string | null;
  saved_at?: string | null;
  property: Property | null;
};

type Toast = {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
};

const FALLBACK_IMAGE = '/images/fallback-property.png';

function isValidHttpUrl(maybe: string | null | undefined) {
  if (!maybe) return false;
  try {
    const u = new URL(maybe);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function safeImgSrc(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return FALLBACK_IMAGE;
  if (s.startsWith('/')) return s;

  // Try to normalize common bad URLs (spaces) without breaking already-encoded URLs.
  const normalized = s.includes(' ') ? s.replace(/\s/g, '%20') : s;
  return isValidHttpUrl(normalized) ? normalized : FALLBACK_IMAGE;
}

function moneyGBP(value: any) {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value.replace(/[^\d.-]/g, '')) : Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  });
}

function formatPercent(n: any) {
  if (n === null || n === undefined || n === '') return '—';
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `${v.toFixed(1)}%`;
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB');
}

function areaLabel(p: Property | null): string {
  if (!p) return '—';
  if (p.area_key) return String(p.area_key);
  if (p.area) return String(p.area);
  const pc = (p.postcode ?? '').toString().trim();
  if (!pc) return '—';
  return pc.split(/\s+/)[0] ?? '—';
}

export default function SavedDealsView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [deals, setDeals] = useState<SavedDeal[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busyRemove, setBusyRemove] = useState<Record<string, boolean>>({});
  const [busyClearAll, setBusyClearAll] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((type: Toast['type'], message: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const selectedDeals = useMemo(() => {
    const map = new Map(deals.map((d) => [d.property_id, d]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as SavedDeal[];
  }, [selectedIds, deals]);

  const selectedNorms = useMemo(
    () =>
      selectedDeals.map((d) => ({
        deal: d,
        norm: normalizeProperty({ ...(d.property ?? {}), id: d.property_id }),
      })),
    [selectedDeals],
  );

  async function load() {
    setLoading(true);
    setError(null);
    setAuthRequired(false);

    try {
      const r = await fetch('/api/saved-deals', { cache: 'no-store' });
      if (r.status === 401) {
        setDeals([]);
        setAuthRequired(true);
        setLoading(false);
        return;
      }
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        throw new Error(t || `Failed to load saved deals (${r.status})`);
      }
      const data = await r.json().catch(() => ({}));
      const list: SavedDeal[] = Array.isArray((data as any)?.deals) ? (data as any).deals : [];
      setDeals(list);
    } catch (e: any) {
      setDeals([]);
      setError(e?.message || 'Failed to load saved deals.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function toggleCompare(propertyId: string) {
    setSelected((prev) => {
      const next = { ...prev };
      const currently = !!next[propertyId];

      if (!currently) {
        const count = Object.values(next).filter(Boolean).length;
        if (count >= 4) {
          pushToast('info', 'You can compare up to 4 deals.');
          return prev;
        }
      }

      next[propertyId] = !currently;
      return next;
    });
  }

  function clearCompare() {
    setSelected({});
    pushToast('info', 'Compare selection cleared.');
  }

  async function removeDeal(d: SavedDeal) {
    const pid = d.property_id;
    if (!pid) return;
    setBusyRemove((p) => ({ ...p, [pid]: true }));

    const prevDeals = deals;
    setDeals((cur) => cur.filter((x) => x.property_id !== pid));
    setSelected((cur) => {
      const next = { ...cur };
      delete next[pid];
      return next;
    });

    try {
      const url = new URL('/api/saved-deals', window.location.origin);
      url.searchParams.set('property_id', pid);
      const r = await fetch(url.toString(), { method: 'DELETE' });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        throw new Error(t || 'Could not remove this deal.');
      }

      pushToast('success', 'Removed from Saved Deals.');
    } catch (e: any) {
      setDeals(prevDeals);
      setError(e?.message || 'Could not remove this deal.');
      pushToast('error', e?.message || 'Could not remove this deal.');
    } finally {
      setBusyRemove((p) => ({ ...p, [pid]: false }));
    }
  }

  async function clearAll() {
    if (!window.confirm('Clear all saved deals?')) return;
    setBusyClearAll(true);
    setError(null);

    try {
      const r = await fetch('/api/saved-deals/clear', { method: 'POST' });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        throw new Error(t || 'Could not clear saved deals.');
      }
      setDeals([]);
      setSelected({});
      pushToast('success', 'Cleared all saved deals.');
    } catch (e: any) {
      setError(e?.message || 'Could not clear saved deals.');
      pushToast('error', e?.message || 'Could not clear saved deals.');
    } finally {
      setBusyClearAll(false);
    }
  }

  return (
    <>
      <Section>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <SectionTitle>Saved Deals</SectionTitle>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Select 2–4 deals to compare side-by-side.
            </div>
            {!loading && !error && !authRequired ? (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{deals.length} saved</div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 ? (
              <button
                type="button"
                className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
                onClick={clearCompare}
              >
                Clear compare ({selectedIds.length})
              </button>
            ) : null}
            <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={load}>
              Refresh
            </button>
          </div>
        </div>

      {authRequired ? (
        <div className="card p-6">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">Sign in required</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Sign in to view your saved deals.
          </div>
          <div className="mt-4">
            <Link href="/sign-in?redirect_url=/saved" className="btn-primary px-5 py-2 inline-flex">
              Sign in
            </Link>
          </div>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-0 overflow-hidden">
              <div className="aspect-[16/9] bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                <div className="h-8 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="card p-6">
          <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">Saved Deals unavailable</div>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{error}</div>
          <div className="mt-4">
            <button type="button" className="btn-primary px-5 py-2 inline-flex" onClick={load}>
              Retry
            </button>
          </div>
        </div>
      ) : deals.length === 0 ? (
        <div className="card p-6">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">No saved deals yet</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Save properties from Listings to build a shortlist.
          </div>
          <div className="mt-4">
            <Link href="/listings" className="btn-primary px-5 py-2 inline-flex">
              Browse listings
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-sm text-slate-600 dark:text-slate-300">{deals.length} saved</div>
            <button
              type="button"
              className="text-sm font-semibold text-rose-700 dark:text-rose-300 hover:underline disabled:opacity-60"
              onClick={clearAll}
              disabled={busyClearAll}
            >
              {busyClearAll ? 'Clearing…' : 'Clear all'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {deals.map((d) => {
              const p = d.property;
              const pid = d.property_id;

              const norm = normalizeProperty({ ...(p ?? {}), id: pid });

              const title =
                (norm.title && norm.title.trim()) ||
                (norm.location ? `Property in ${norm.location}` : '') ||
                'Saved property';

              const loc = norm.location ? norm.location : '—';
              const price = moneyGBP(norm.price);
              const beds = typeof norm.bedrooms === 'number' ? String(norm.bedrooms) : '—';
              const baths = typeof norm.bathrooms === 'number' ? String(norm.bathrooms) : '—';
              const y = formatPercent(norm.yieldPct);
              const roi = formatPercent(norm.roiPct);
              const savedOn = formatDate(d.saved_at ?? d.created_at ?? null);
              const scoreRaw = Number((p as any)?.ai_score ?? (p as any)?.score);
              const score = Number.isFinite(scoreRaw) ? scoreRaw : 60;
              const rent = moneyGBP(norm.rentPcm);
              const area = norm.areaLabel || areaLabel(p);

              const selectedOn = !!selected[pid];
              const compareDisabled = !selectedOn && selectedIds.length >= 4;

              return (
                <div key={pid} className="card p-0 overflow-hidden">
                  <div className="relative">
                    <div className="aspect-[16/9] bg-slate-100 dark:bg-slate-800">
                      <img
                        src={safeImgSrc(norm.imageUrl)}
                        alt={title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (img.src.endsWith(FALLBACK_IMAGE)) return;
                          img.src = FALLBACK_IMAGE;
                        }}
                      />
                    </div>

                    <label className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-xl bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={selectedOn}
                        disabled={compareDisabled}
                        onChange={() => toggleCompare(pid)}
                        aria-label="Select deal for comparison"
                      />
                      Compare
                      {compareDisabled ? <span className="text-xs opacity-60">(max 4)</span> : null}
                    </label>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{title}</div>
                        <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 truncate">{loc}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-slate-900 dark:text-white whitespace-nowrap">{price}</div>
                        {savedOn ? <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Saved {savedOn}</div> : null}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 items-center text-xs text-slate-700 dark:text-slate-200">
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 font-semibold">
                        {beds} beds • {baths} baths
                      </span>
                      <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 font-semibold text-emerald-700 dark:text-emerald-200">
                        Yield {y}
                      </span>
                      <span className="rounded-full bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 font-semibold text-blue-700 dark:text-blue-200">
                        ROI {roi}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-semibold">Score:</span> {Math.round(score)}/100 ·{' '}
                      <span className="font-semibold">Rent/mo:</span> {rent} ·{' '}
                      <span className="font-semibold">Area:</span> {area}
                    </div>

                    {!p ? (
                      <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                        Property details couldn’t be loaded for this saved item.
                      </div>
                    ) : null}

                    <div className="mt-4 flex gap-2">
                      <Link
                        href={`/property/${encodeURIComponent(pid)}`}
                        className="flex-1 text-center rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        className="flex-1 text-center rounded-md border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-sm font-semibold text-rose-700 dark:text-rose-200 disabled:opacity-60"
                        onClick={() => removeDeal(d)}
                        disabled={!!busyRemove[pid]}
                        aria-label="Remove saved deal"
                      >
                        {busyRemove[pid] ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedDeals.length >= 2 ? (
            <div className="mt-6 card p-0 overflow-hidden">
              <div className="p-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Deal comparison</div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    Side-by-side for {selectedDeals.length} deals
                  </div>
                </div>
                <button
                  type="button"
                  className="text-sm font-semibold text-brand-700 dark:text-brand-300 hover:underline"
                  onClick={clearCompare}
                >
                  Clear
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-t border-slate-200 dark:border-slate-800">
                  <thead>
                    <tr className="text-left">
                      <th className="p-3 text-xs font-semibold text-slate-600 dark:text-slate-300">Metric</th>
                      {selectedNorms.map(({ deal, norm }) => {
                        const name =
                          (norm.title && norm.title.trim()) ||
                          (deal.property_id ? deal.property_id.slice(0, 8) : 'Property');
                        const sub = norm.location ? norm.location : '—';
                        return (
                          <th key={deal.property_id} className="p-3 align-top">
                            <div className="text-xs font-semibold text-slate-900 dark:text-white">{name}</div>
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{sub}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        {
                          label: 'Price',
                          get: (p: ReturnType<typeof normalizeProperty>) => moneyGBP(p.price),
                        },
                        {
                          label: 'Beds / Baths',
                          get: (p: ReturnType<typeof normalizeProperty>) => {
                            const b = typeof p.bedrooms === 'number' ? p.bedrooms : '—';
                            const ba = typeof p.bathrooms === 'number' ? p.bathrooms : '—';
                            return `${b}/${ba}`;
                          },
                        },
                        {
                          label: 'Score',
                          get: (p: ReturnType<typeof normalizeProperty>) => {
                            const s = Number(p.raw?.ai_score ?? p.raw?.score);
                            const v = Number.isFinite(s) ? s : 60;
                            return `${Math.round(v)}/100`;
                          },
                        },
                        {
                          label: 'Yield',
                          get: (p: ReturnType<typeof normalizeProperty>) => formatPercent(p.yieldPct),
                        },
                        {
                          label: 'ROI',
                          get: (p: ReturnType<typeof normalizeProperty>) => formatPercent(p.roiPct),
                        },
                        {
                          label: 'Rent / mo',
                          get: (p: ReturnType<typeof normalizeProperty>) => moneyGBP(p.rentPcm),
                        },
                        {
                          label: 'Area',
                          get: (p: ReturnType<typeof normalizeProperty>) => p.areaLabel || '—',
                        },
                      ] as const
                    ).map((row) => (
                      <tr key={row.label} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="p-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{row.label}</td>
                        {selectedNorms.map(({ deal, norm }) => (
                          <td key={`${deal.property_id}-${row.label}`} className="p-3 text-sm text-slate-700 dark:text-slate-200">
                            {row.get(norm)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      )}
      </Section>

      <ToastStack toasts={toasts} />
    </>
  );
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => {
        const tone =
          t.type === 'success'
            ? 'border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-200'
            : t.type === 'error'
              ? 'border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200'
              : 'border-blue-200 dark:border-blue-900/40 text-blue-800 dark:text-blue-200';

        return (
          <div
            key={t.id}
            className={`max-w-sm rounded-xl border bg-white/95 dark:bg-slate-900/90 px-4 py-3 text-sm font-semibold shadow-sm ${tone}`}
          >
            {t.message}
          </div>
        );
      })}
    </div>
  );
}
