'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';

import { BroadenBanner } from '@/components/BroadenBanner';
import FilterBar, { type FilterBarValue } from '@/components/FilterBar';
import PropertyCard from '@/components/PropertyCard';
import { Skeleton } from '@/components/Skeleton';
import { useSearchFilterParams } from '@/hooks/useSearchParams';
import { useStreamedSearch, type SearchHit } from '@/hooks/useStreamedSearch';

type SearchItem = {
  id: string;
  title?: string;
  location?: string;
  price?: number;
  bedrooms?: number;
  yield?: number;
};

function toSearchItem(hit: SearchHit): SearchItem | null {
  const id = typeof hit.id === 'string' ? hit.id : null;
  if (!id) return null;

  return {
    id,
    title: typeof hit.title === 'string' ? hit.title : undefined,
    location: typeof hit.location === 'string' ? hit.location : undefined,
    price: typeof hit.price === 'number' ? hit.price : undefined,
    bedrooms: typeof hit.bedrooms === 'number' ? hit.bedrooms : undefined,
  };
}

function SkeletonResults() {
  return (
    <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <Skeleton h={180} r={10} />
          <div className="mt-3 space-y-2">
            <Skeleton h={16} w="70%" />
            <Skeleton h={14} w="50%" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl p-4">Loading…</main>}>
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  const { state, setQueryParams, resetQueryParams } = useSearchFilterParams();
  const [allowBroaden, setAllowBroaden] = useState(true);

  const filterBarValue: FilterBarValue = useMemo(
    () => ({
      bedsMin: state.bedsMin,
      bedsMax: state.bedsMax,
      priceMin: state.priceMin ?? 0,
      priceMax: state.priceMax ?? 300000,
      yieldMin: state.yieldMin ?? 0,
    }),
    [state],
  );

  const payload = useMemo(
    () => ({
      q: state.q || 'london',
      allow_broaden: allowBroaden,
      filters: {
        beds:
          typeof state.bedsMin === 'number' || typeof state.bedsMax === 'number'
            ? { gte: state.bedsMin, lte: state.bedsMax }
            : undefined,
        price:
          typeof state.priceMax === 'number' || typeof state.priceMin === 'number'
            ? { gte: state.priceMin, lte: state.priceMax }
            : undefined,
        yield: typeof state.yieldMin === 'number' ? { gte: state.yieldMin } : undefined,
      },
    }),
    [allowBroaden, state],
  );

  const { hits, loading, meta } = useStreamedSearch(payload);

  useEffect(() => {
    setAllowBroaden(true);
  }, [state.q, state.bedsMin, state.bedsMax, state.priceMin, state.priceMax, state.yieldMin]);

  const items = useMemo(
    () => hits.map((h) => toSearchItem(h)).filter((h): h is SearchItem => h !== null),
    [hits],
  );
  const total = items.length;

  return (
    <main className="mx-auto max-w-6xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">Search</h1>

      <FilterBar
        value={filterBarValue}
        onChange={(next) => {
          setQueryParams({
            q: state.q,
            bedsMin: next.bedsMin,
            bedsMax: next.bedsMax,
            priceMin: next.priceMin,
            priceMax: next.priceMax,
            yieldMin: next.yieldMin,
          });
        }}
        onReset={() => {
          resetQueryParams();
        }}
      />

      <p className="mt-4 text-sm text-gray-500">
        {total} results{loading ? ' (streaming...)' : ''}
      </p>

      {meta.broadened && (
        <BroadenBanner
          changes={meta.changes || {}}
          onUndo={() => {
            setAllowBroaden(false);
          }}
        />
      )}

      {loading && items.length === 0 && <SkeletonResults />}

      <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => (
          <PropertyCard
            key={item.id}
            p={{
              id: item.id,
              title: item.title || item.id,
              location: item.location,
              price: item.price,
              bedrooms: item.bedrooms,
            }}
            rank={index + 1}
          />
        ))}
      </div>
    </main>
  );
}
