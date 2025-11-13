"use client";

import React, { useEffect, useState } from 'react';
import type { DealFilters } from '@/lib/offmarket/types';

type Props = {
  filters: DealFilters;
  onFiltersChange: (f: DealFilters) => void;
};

export default function OffMarketFilters({ filters, onFiltersChange }: Props) {
  const [local, setLocal] = useState<DealFilters>(filters);

  useEffect(() => setLocal(filters), [filters]);

  return (
    <div className="card p-4 space-y-4">
      <div>
        <label className="text-sm text-zinc-600">Postcode</label>
        <input
          className="mt-1 w-full rounded-md border px-3 py-2"
          placeholder="e.g., SW1A 1AA"
          value={local.postcode || ''}
          onChange={(e) => setLocal({ ...local, postcode: e.target.value })}
        />
      </div>

      <div>
        <label className="text-sm text-zinc-600">Min Price (£{(local.minPrice || 0).toLocaleString()})</label>
        <input
          type="range"
          min={0}
          max={1000000}
          step={10000}
          className="w-full"
          value={local.minPrice || 0}
          onChange={(e) => setLocal({ ...local, minPrice: Number(e.target.value) })}
        />
      </div>

      <div>
        <label className="text-sm text-zinc-600">Max Price (£{(local.maxPrice || 1000000).toLocaleString()})</label>
        <input
          type="range"
          min={0}
          max={1000000}
          step={10000}
          className="w-full"
          value={local.maxPrice || 1000000}
          onChange={(e) => setLocal({ ...local, maxPrice: Number(e.target.value) })}
        />
      </div>

      <div>
        <label className="text-sm text-zinc-600">Min Discount ({local.minDiscount || 0}%)</label>
        <input
          type="range"
          min={0}
          max={50}
          step={5}
          className="w-full"
          value={local.minDiscount || 0}
          onChange={(e) => setLocal({ ...local, minDiscount: Number(e.target.value) })}
        />
      </div>

      <div>
        <label className="text-sm text-zinc-600">Min Score ({local.minScore || 0})</label>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          className="w-full"
          value={local.minScore || 0}
          onChange={(e) => setLocal({ ...local, minScore: Number(e.target.value) })}
        />
      </div>

      <div className="flex gap-2">
        <button
          className="btn-primary px-3 py-2 rounded-lg"
          onClick={() => onFiltersChange(local)}
        >
          Apply Filters
        </button>
        <button
          className="px-3 py-2 rounded-lg border"
          onClick={() => {
            const empty: DealFilters = {};
            setLocal(empty);
            onFiltersChange(empty);
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
