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

  // Count active filters
  const activeCount = Object.entries(local).filter(([key, value]) => {
    if (key === 'minPrice' && value === 0) return false;
    if (key === 'maxPrice' && value === 1000000) return false;
    if (key === 'minDiscount' && value === 0) return false;
    if (key === 'minScore' && value === 0) return false;
    if (key === 'minBedrooms' && value === 0) return false;
    if (key === 'minBathrooms' && value === 0) return false;
    if (key === 'postcode' && (!value || value === '')) return false;
    return value !== null && value !== undefined && value !== '';
  }).length;

  // Auto-apply filters when they change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange(local);
    }, 500);
    return () => clearTimeout(timer);
  }, [local, onFiltersChange]);

  return (
    <aside className="space-y-4">
      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Filters
            </h3>
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-blue-500 text-white text-xs font-medium">
                {activeCount}
              </span>
            )}
          </div>
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 underline"
            onClick={handleClear}
          >
            Clear all
          </button>
        </div>

        <div className="space-y-4">
          {/* Postcode Search */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              Postcode / Location
            </label>
            <input
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="e.g. SW1A 1AA or Liverpool"
              value={local.postcode || ''}
              onChange={(e) => setLocal({ ...local, postcode: e.target.value })}
            />
          </div>

          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
            {/* Price Range */}
            <div className="space-y-3">
              <div>
                <label className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  <span>Min Price</span>
                  <span className="font-normal text-zinc-500">
                    £{(local.minPrice || 0).toLocaleString()}
                  </span>
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min={0}
                    max={1000000}
                    step={10000}
                    className="flex-1"
                    value={local.minPrice || 0}
                    onChange={(e) =>
                      setLocal({ ...local, minPrice: Number(e.target.value) })
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    step={10000}
                    className="w-24 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                    placeholder="Min"
                    value={local.minPrice || 0}
                    onChange={(e) =>
                      setLocal({ ...local, minPrice: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  <span>Max Price</span>
                  <span className="font-normal text-zinc-500">
                    {local.maxPrice ? `£${local.maxPrice.toLocaleString()}` : 'No limit'}
                  </span>
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min={0}
                    max={1000000}
                    step={10000}
                    className="flex-1"
                    value={local.maxPrice || 1000000}
                    onChange={(e) =>
                      setLocal({ ...local, maxPrice: Number(e.target.value) })
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    step={10000}
                    className="w-24 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                    placeholder="Max"
                    value={local.maxPrice || 1000000}
                    onChange={(e) =>
                      setLocal({ ...local, maxPrice: Number(e.target.value) || 1000000 })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
            {/* Bedrooms and Bathrooms */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Min Bedrooms
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="Any"
                  value={local.minBedrooms || ''}
                  onChange={(e) =>
                    setLocal({ ...local, minBedrooms: Number(e.target.value) || undefined })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Min Bathrooms
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="Any"
                  value={local.minBathrooms || ''}
                  onChange={(e) =>
                    setLocal({ ...local, minBathrooms: Number(e.target.value) || undefined })
                  }
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
            {/* Investment Metrics */}
            <div className="space-y-3">
              <div>
                <label className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  <span>Min Discount %</span>
                  <span className="font-normal text-zinc-500">
                    {(local.minDiscount || 0).toFixed(0)}%
                  </span>
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    className="flex-1"
                    value={local.minDiscount || 0}
                    onChange={(e) =>
                      setLocal({ ...local, minDiscount: Number(e.target.value) })
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={1}
                    className="w-16 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                    placeholder="0"
                    value={local.minDiscount || 0}
                    onChange={(e) =>
                      setLocal({ ...local, minDiscount: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  <span>Min Investment Score</span>
                  <span className="font-normal text-zinc-500">
                    {local.minScore || 0}
                  </span>
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    className="flex-1"
                    value={local.minScore || 0}
                    onChange={(e) =>
                      setLocal({ ...local, minScore: Number(e.target.value) })
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className="w-16 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                    placeholder="0"
                    value={local.minScore || 0}
                    onChange={(e) =>
                      setLocal({ ...local, minScore: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
