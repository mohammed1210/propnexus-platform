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

  const handleClear = () => {
    const empty: DealFilters = {};
    setLocal(empty);
    onFiltersChange(empty);
  };

  return (
    <aside className="space-y-4">
      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Filters
          </h3>
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            onClick={handleClear}
          >
            Clear
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Postcode
            </label>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="e.g. SW1A 1AA"
              value={local.postcode || ''}
              onChange={(e) => setLocal({ ...local, postcode: e.target.value })}
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <span>Min Price</span>
                <span className="font-normal text-zinc-500">
                  £{(local.minPrice || 0).toLocaleString()}
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={1000000}
                step={10000}
                className="w-full"
                value={local.minPrice || 0}
                onChange={(e) =>
                  setLocal({ ...local, minPrice: Number(e.target.value) })
                }
              />
            </div>

            <div>
              <label className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <span>Max Price</span>
                <span className="font-normal text-zinc-500">
                  £{(local.maxPrice || 1000000).toLocaleString()}
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={1000000}
                step={10000}
                className="w-full"
                value={local.maxPrice || 1000000}
                onChange={(e) =>
                  setLocal({ ...local, maxPrice: Number(e.target.value) })
                }
              />
            </div>

            <div>
              <label className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <span>Min Discount</span>
                <span className="font-normal text-zinc-500">
                  {(local.minDiscount || 0).toFixed(0)}%
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={50}
                step={5}
                className="w-full"
                value={local.minDiscount || 0}
                onChange={(e) =>
                  setLocal({ ...local, minDiscount: Number(e.target.value) })
                }
              />
            </div>

            <div>
              <label className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <span>Min Score</span>
                <span className="font-normal text-zinc-500">
                  {local.minScore || 0}
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                className="w-full"
                value={local.minScore || 0}
                onChange={(e) =>
                  setLocal({ ...local, minScore: Number(e.target.value) })
                }
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          className="mt-1 w-full rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-900"
          onClick={() => onFiltersChange(local)}
        >
          Apply filters
        </button>
      </div>
    </aside>
  );
}
