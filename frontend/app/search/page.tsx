'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';

import FilterBar, { type FilterBarValue } from '@/components/FilterBar';
import { useSearchFilterParams } from '@/hooks/useSearchParams';

type SearchItem = {
  id: string;
  title?: string;
  location?: string;
  price?: number;
  bedrooms?: number;
  yield?: number;
};

type SearchResponse = {
  items: SearchItem[];
  total_results: number;
  facets?: Record<string, Record<string, number>>;
};

export default function SearchPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl p-4">Loading…</main>}>
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  const { state, setQueryParams, resetQueryParams } = useSearchFilterParams();
  const [items, setItems] = useState<SearchItem[]>([]);
  const [total, setTotal] = useState(0);

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

  useEffect(() => {
    const payload = {
      q: state.q || 'london',
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
    };

    void fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data: SearchResponse) => {
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotal(typeof data?.total_results === 'number' ? data.total_results : 0);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      });
  }, [state]);

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

      <p className="mt-4 text-sm text-gray-500">{total} results</p>

      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-md border p-3">
            <p className="font-medium">{item.title || item.id}</p>
            <p className="text-sm text-gray-600">
              {item.location || 'Unknown'}
              {typeof item.price === 'number' ? ` • £${item.price.toLocaleString()}` : ''}
              {typeof item.bedrooms === 'number' ? ` • ${item.bedrooms} bed` : ''}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
