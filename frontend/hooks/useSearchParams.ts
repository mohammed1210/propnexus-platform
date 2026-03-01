'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type SearchFilterState = {
  q: string;
  bedsMin?: number;
  bedsMax?: number;
  priceMin?: number;
  priceMax?: number;
  yieldMin?: number;
};

function parseNum(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseBedsRange(value: string | null): { bedsMin?: number; bedsMax?: number } {
  if (!value) return {};
  const [a, b] = value.split('-');
  const bedsMin = parseNum(a ?? null);
  const bedsMax = parseNum(b ?? null);
  return { bedsMin, bedsMax };
}

function buildBedsParam(min?: number, max?: number): string | undefined {
  if (typeof min === 'number' && typeof max === 'number') return `${min}-${max}`;
  if (typeof min === 'number') return `${min}-${min}`;
  return undefined;
}

export function useSearchFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo<SearchFilterState>(() => {
    const q = searchParams?.get('q') ?? '';
    const { bedsMin, bedsMax } = parseBedsRange(searchParams?.get('beds') ?? null);
    return {
      q,
      bedsMin,
      bedsMax,
      priceMin: parseNum(searchParams?.get('price_min') ?? null),
      priceMax: parseNum(searchParams?.get('price_max') ?? null),
      yieldMin: parseNum(searchParams?.get('yield_min') ?? null),
    };
  }, [searchParams]);

  const setQueryParams = useCallback(
    (next: SearchFilterState) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');

      if (next.q) params.set('q', next.q);
      else params.delete('q');

      const beds = buildBedsParam(next.bedsMin, next.bedsMax);
      if (beds) params.set('beds', beds);
      else params.delete('beds');

      if (typeof next.priceMin === 'number') params.set('price_min', String(next.priceMin));
      else params.delete('price_min');

      if (typeof next.priceMax === 'number') params.set('price_max', String(next.priceMax));
      else params.delete('price_max');

      if (typeof next.yieldMin === 'number') params.set('yield_min', String(next.yieldMin));
      else params.delete('yield_min');

      const target = `${pathname}?${params.toString()}`;
      router.replace(target, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const resetQueryParams = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  return { state, setQueryParams, resetQueryParams };
}
