'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import { getSupabase } from '@/lib/supabaseClient';
import { safeFetch, API_BASE } from '@/lib/api';

import SavedDealCard from './SavedDealCard';
import DealComparePanel from './DealComparePanel';
import { useSavedDeals } from './useSavedDeals';
import type { ComparableDeal, SavedDeal } from './types';

type DealMap = Map<string, ComparableDeal>;

function pickComparableFromSaved(deal: SavedDeal): ComparableDeal {
  return {
    id: String(deal.property_id ?? deal.id),
    source: 'saved',
    title: deal.title ?? null,
    location: deal.location ?? null,
    postcode: deal.postcode ?? null,
    price: deal.price ?? null,
    bedrooms: deal.bedrooms ?? null,
    bathrooms: deal.bathrooms ?? null,
    yield_percent: deal.yield_percent ?? null,
    roi_percent: deal.roi_percent ?? null,
    imageurl: deal.imageurl ?? null,
    investment_type: deal.investment_type ?? null,
    score: null,
    score_breakdown: null,
  };
}

async function fetchComparableDealsByIds(propertyIds: string[]): Promise<ComparableDeal[]> {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  if (supabaseConfigured) {
    try {
      const sb = getSupabase();

      const { data, error } = await sb
        .from('properties')
        .select(
          [
            'id',
            'title',
            'location',
            'postcode',
            'price',
            'bedrooms',
            'bathrooms',
            'yield_percent',
            'roi_percent',
            'score',
            'ai_score',
            'imageurl',
            'investment_type',
            'score_breakdown',
          ].join(','),
        )
        .in('id', propertyIds);

      if (error) throw error;
      if (!Array.isArray(data)) return [];

      const fromSupabase: ComparableDeal[] = data.map((row: any) => ({
        id: String(row.id),
        source: 'supabase' as const,
        title: row.title ?? null,
        location: row.location ?? null,
        postcode: row.postcode ?? null,
        price: typeof row.price === 'number' ? row.price : row.price == null ? null : Number(row.price),
        bedrooms:
          typeof row.bedrooms === 'number'
            ? row.bedrooms
            : row.bedrooms == null
              ? null
              : Number(row.bedrooms),
        bathrooms:
          typeof row.bathrooms === 'number'
            ? row.bathrooms
            : row.bathrooms == null
              ? null
              : Number(row.bathrooms),
        yield_percent:
          typeof row.yield_percent === 'number'
            ? row.yield_percent
            : row.yield_percent == null
              ? null
              : Number(row.yield_percent),
        roi_percent:
          typeof row.roi_percent === 'number'
            ? row.roi_percent
            : row.roi_percent == null
              ? null
              : Number(row.roi_percent),
        score: typeof row.score === 'number' ? row.score : row.score == null ? null : Number(row.score),
        ai_score:
          typeof row.ai_score === 'number' ? row.ai_score : row.ai_score == null ? null : Number(row.ai_score),
        imageurl: row.imageurl ?? null,
        investment_type: row.investment_type ?? null,
        score_breakdown: (row.score_breakdown ?? null) as any,
      }));

      const have = new Set(fromSupabase.map((d) => d.id));
      const missing = propertyIds.filter((id) => !have.has(id));

      if (missing.length === 0) {
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[saved] compare enrichment', {
            requested: propertyIds.length,
            supabase: fromSupabase.length,
            backend: 0,
          });
        }
        return fromSupabase;
      }

      const fromBackend = await fetchComparableDealsByIdsViaBackend(missing);

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[saved] compare enrichment', {
          requested: propertyIds.length,
          supabase: fromSupabase.length,
          backend: fromBackend.length,
          backfilled: missing.length,
        });
      }

      return [...fromSupabase, ...fromBackend];
    } catch {
      // continue to backend fallback
    }
  }

  const fromBackend = await fetchComparableDealsByIdsViaBackend(propertyIds);
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[saved] compare enrichment', {
      requested: propertyIds.length,
      supabase: 0,
      backend: fromBackend.length,
    });
  }
  return fromBackend;
}

async function fetchComparableDealsByIdsViaBackend(propertyIds: string[]): Promise<ComparableDeal[]> {
  // Backend fallback (small N: selection is 2–4).
  const base = API_BASE.replace(/\/+$/, '');
  const out: ComparableDeal[] = [];
  await Promise.all(
    propertyIds.map(async (id) => {
      try {
        const p = await safeFetch<any>(`${base}/properties/${encodeURIComponent(id)}`);
        out.push({
          id: String(p?.id ?? id),
          source: 'backend' as const,
          title: p?.title ?? null,
          location: p?.location ?? null,
          postcode: p?.postcode ?? null,
          price: p?.price ?? null,
          bedrooms: p?.bedrooms ?? null,
          bathrooms: p?.bathrooms ?? null,
          yield_percent: p?.yield_percent ?? null,
          roi_percent: p?.roi_percent ?? null,
          score: p?.score ?? null,
          ai_score: p?.ai_score ?? null,
          imageurl: p?.imageurl ?? null,
          investment_type: p?.investment_type ?? null,
          score_breakdown: p?.score_breakdown ?? null,
        });
      } catch {
        // ignore individual failures
      }
    }),
  );
  return out;
}

export default function SavedDealsView() {
  const { deals, loading, error, authRequired, selectedPropertyIds, toggleSelect, clearSelection, removeSaved, maxHint } =
    useSavedDeals();

  const [removingId, setRemovingId] = useState<string | null>(null);

  const [compareOpen, setCompareOpen] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [cache, setCache] = useState<DealMap>(() => new Map());

  const lastHintRef = useRef<string | null>(null);
  useEffect(() => {
    if (!maxHint) return;
    if (lastHintRef.current === maxHint) return;
    lastHintRef.current = maxHint;
    toast.info(maxHint);
  }, [maxHint]);

  const selectedDeals = useMemo(() => {
    const byProp = new Map<string, SavedDeal>();
    for (const d of deals) {
      if (d.property_id) byProp.set(d.property_id, d);
    }

    return selectedPropertyIds.map((pid) => {
      const cached = cache.get(pid);
      if (cached) return cached;
      const fromSaved = byProp.get(pid);
      return fromSaved ? pickComparableFromSaved(fromSaved) : ({ id: pid } as ComparableDeal);
    });
  }, [cache, deals, selectedPropertyIds]);

  // Fetch property details only when selected (2–4) and missing from cache.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (selectedPropertyIds.length === 0) return;
      const missing = selectedPropertyIds.filter((id) => !cache.has(id));
      if (missing.length === 0) return;

      setCompareLoading(true);
      try {
        const fetched = await fetchComparableDealsByIds(missing);
        if (cancelled) return;

        setCache((prev) => {
          const next = new Map(prev);
          for (const d of fetched) next.set(d.id, d);
          return next;
        });
      } finally {
        if (!cancelled) setCompareLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cache, selectedPropertyIds]);

  const handleRemove = async (savedDealId: string) => {
    if (!window.confirm('Remove this saved deal?')) return;
    try {
      setRemovingId(savedDealId);
      await removeSaved(savedDealId);
      toast.success('Removed from Saved Deals');
    } catch {
      toast.error('Could not remove saved deal');
    } finally {
      setRemovingId(null);
    }
  };

  const canCompare = selectedPropertyIds.length >= 2;

  return (
    <Section>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <SectionTitle>Saved Deals</SectionTitle>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Select 2–4 deals to compare side-by-side.
          </div>
          {maxHint ? (
            <div className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
              {maxHint}
            </div>
          ) : null}
        </div>

        {/* Mobile compare button */}
        <div className="md:hidden">
          <button
            type="button"
            className={
              canCompare
                ? 'btn-primary text-sm px-4 py-2'
                : 'rounded-md border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 opacity-60'
            }
            onClick={() => setCompareOpen(true)}
            disabled={!canCompare}
          >
            Compare ({selectedPropertyIds.length})
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
        <div className="p-4">Loading…</div>
      ) : error ? (
        <div className="card p-6">
          <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</div>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Try refreshing the page.
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
        <div className="grid grid-cols-1 md:grid-cols-[1fr,360px] gap-6">
          {/* Left: saved deals list */}
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {deals.map((d) => (
                <SavedDealCard
                  key={d.id}
                  deal={d}
                  selected={Boolean(d.property_id && selectedPropertyIds.includes(d.property_id))}
                  disabled={!d.property_id}
                  onToggle={() => (d.property_id ? toggleSelect(d.property_id) : undefined)}
                  onRemove={() => handleRemove(d.id)}
                  removing={removingId === d.id}
                />
              ))}
            </div>
          </div>

          {/* Right: sticky compare panel (desktop) */}
          <aside className="hidden md:block md:sticky md:top-20 h-fit md:pb-24">
            {compareLoading ? (
              <div className="card p-4 text-sm text-slate-600 dark:text-slate-300">Loading comparison…</div>
            ) : (
              <DealComparePanel deals={selectedDeals} onClear={clearSelection} />
            )}
          </aside>
        </div>
      )}

      {/* Mobile modal drawer */}
      {compareOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Deal comparison"
          className="fixed inset-0 z-50 bg-black/40 p-4 flex items-end md:hidden"
          onClick={() => setCompareOpen(false)}
        >
          <div
            className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-4 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Compare</div>
              <button
                type="button"
                className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:underline"
                onClick={() => setCompareOpen(false)}
              >
                Close
              </button>
            </div>

            {compareLoading ? (
              <div className="text-sm text-slate-600 dark:text-slate-300">Loading comparison…</div>
            ) : (
              <DealComparePanel deals={selectedDeals} onClear={clearSelection} />
            )}
          </div>
        </div>
      )}
    </Section>
  );
}
