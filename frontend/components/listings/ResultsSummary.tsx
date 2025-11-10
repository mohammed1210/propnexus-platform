'use client';

import { FilterParams } from '@/types/listings';
import { LuLayoutGrid, LuList, LuX } from 'react-icons/lu';

interface ResultsSummaryProps {
  totalCount: number;
  filters: FilterParams;
  loading: boolean;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

export default function ResultsSummary({ 
  totalCount, 
  filters, 
  loading,
  viewMode,
  onViewModeChange 
}: ResultsSummaryProps) {
  const activeFilters = [
    filters.search && { key: 'search', label: `"${filters.search}"`, value: filters.search },
    filters.minPrice && { key: 'minPrice', label: `Min £${filters.minPrice.toLocaleString()}`, value: filters.minPrice },
    filters.maxPrice && { key: 'maxPrice', label: `Max £${filters.maxPrice.toLocaleString()}`, value: filters.maxPrice },
    filters.bedrooms && { key: 'bedrooms', label: `${filters.bedrooms}+ beds`, value: filters.bedrooms },
    filters.bathrooms && { key: 'bathrooms', label: `${filters.bathrooms}+ baths`, value: filters.bathrooms },
    ...filters.investmentTypes.map(type => ({ key: `type-${type}`, label: type, value: type })),
  ].filter(Boolean) as Array<{ key: string; label: string; value: any }>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Results Count */}
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? '...' : totalCount.toLocaleString()}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {totalCount === 1 ? 'property' : 'properties'} found
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="ml-auto md:ml-0">
            <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-1">
              <button
                onClick={() => onViewModeChange('grid')}
                className={`px-3 py-2 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                aria-label="Grid view"
              >
                <LuLayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => onViewModeChange('list')}
                className={`px-3 py-2 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                aria-label="List view"
              >
                <LuList className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <span
                key={filter.key}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                         bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300"
              >
                {filter.label}
                <button
                  onClick={() => {
                    // TODO: Remove specific filter
                  }}
                  className="hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-full p-0.5"
                  aria-label={`Remove ${filter.label} filter`}
                >
                  <LuX className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
