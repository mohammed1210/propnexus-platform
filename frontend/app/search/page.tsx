'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { BroadenBanner } from '@/components/BroadenBanner';
import FilterDrawerMobile from '@/components/FilterDrawerMobile';
import FilterBar, { type FilterBarValue } from '@/components/FilterBar';
import PropertyCard from '@/components/PropertyCard';
import { Skeleton } from '@/components/Skeleton';
import { useSearchFilterParams } from '@/hooks/useSearchParams';
import { useStreamedSearch, type SearchHit } from '@/hooks/useStreamedSearch';
import { generateQueryId } from '@/lib/events';

type SearchItem = {
  id: string;
  title?: string;
  location?: string;
  price?: number;
  bedrooms?: number;
  yield?: number;
  matches?: string[];
};

function toSearchItem(hit: SearchHit): SearchItem | null {
  const id = typeof hit.id === 'string' ? hit.id : null;
  if (!id) return null;

  const matchesRaw = Array.isArray(hit.matches) ? hit.matches : null;
  const matches = matchesRaw
    ? matchesRaw.filter((m): m is string => typeof m === 'string')
    : undefined;

  return {
    id,
    title: typeof hit.title === 'string' ? hit.title : undefined,
    location: typeof hit.location === 'string' ? hit.location : undefined,
    price: typeof hit.price === 'number' ? hit.price : undefined,
    bedrooms: typeof hit.bedrooms === 'number' ? hit.bedrooms : undefined,
    matches: matches && matches.length > 0 ? matches : undefined,
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
  const t = useTranslations('search');

  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl p-4">{t('loading')}</main>}>
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  const t = useTranslations('search');
  const { state, setQueryParams, resetQueryParams } = useSearchFilterParams();
  const [allowBroaden, setAllowBroaden] = useState(true);

  useEffect(() => {
    try {
      const hasUrlFilters =
        typeof state.bedsMin === 'number' ||
        typeof state.bedsMax === 'number' ||
        typeof state.priceMin === 'number' ||
        typeof state.priceMax === 'number' ||
        typeof state.yieldMin === 'number';
      if (hasUrlFilters) return;

      const raw = localStorage.getItem('searchFilters');
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<FilterBarValue>;
      setQueryParams({
        q: state.q || 'london',
        bedsMin: typeof parsed.bedsMin === 'number' ? parsed.bedsMin : undefined,
        bedsMax: typeof parsed.bedsMax === 'number' ? parsed.bedsMax : undefined,
        priceMin: typeof parsed.priceMin === 'number' ? parsed.priceMin : undefined,
        priceMax: typeof parsed.priceMax === 'number' ? parsed.priceMax : undefined,
        yieldMin: typeof parsed.yieldMin === 'number' ? parsed.yieldMin : undefined,
      });
    } catch {
      return;
    }
  }, [setQueryParams, state.bedsMax, state.bedsMin, state.priceMax, state.priceMin, state.q, state.yieldMin]);

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

  const queryId = useMemo(
    () =>
      generateQueryId(
        [state.q, state.bedsMin, state.bedsMax, state.priceMin, state.priceMax, state.yieldMin]
          .map((v) => String(v ?? ''))
          .join('|'),
      ),
    [state.q, state.bedsMin, state.bedsMax, state.priceMin, state.priceMax, state.yieldMin],
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
    <main className="mx-auto max-w-6xl p-4 pb-20 sm:pb-4">
      <h1 className="mb-4 text-2xl font-semibold">{t('title')}</h1>

      <div className="sticky top-0 z-20 hidden border-b border-slate-200 bg-white/80 py-2 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80 sm:block">
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
      </div>

      <FilterDrawerMobile
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

      <p className="mt-4 text-sm text-gray-500" aria-live="polite" aria-atomic="true">
        {t('results', { count: total })}{loading ? ` ${t('streaming')}` : ''}
      </p>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {t('announcement', { count: total })}
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
              matches: item.matches,
            }}
            queryId={queryId}
            queryText={state.q || 'london'}
            filters={payload.filters}
            rank={index + 1}
          />
        ))}
      </div>
    </main>
  );
}
