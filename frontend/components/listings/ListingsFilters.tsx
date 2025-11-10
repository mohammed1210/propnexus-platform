'use client';

import { useState } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { LuPoundSterling, LuBedDouble, LuBath, LuChevronDown, LuChevronUp } from 'react-icons/lu';
import { FilterParams } from '@/types/listings';

const INVESTMENT_TYPES = ['HMO', 'BTL', 'SA', 'BRR', 'Flip', 'Commercial'] as const;

interface ListingsFiltersProps {
  filters: FilterParams;
  onFilterChange: (filters: Partial<FilterParams>) => void;
}

export default function ListingsFilters({ filters, onFilterChange }: ListingsFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);

  const handleApply = () => {
    onFilterChange(localFilters);
  };

  const handleReset = () => {
    const reset: FilterParams = {
      search: '',
      minPrice: undefined,
      maxPrice: undefined,
      bedrooms: undefined,
      bathrooms: undefined,
      investmentTypes: [],
      sort: 'created_at',
      sortDirection: 'desc',
      heatmap: false,
    };
    setLocalFilters(reset);
    onFilterChange(reset);
  };

  const toggleInvestmentType = (type: string) => {
    const types = localFilters.investmentTypes.includes(type)
      ? localFilters.investmentTypes.filter(t => t !== type)
      : [...localFilters.investmentTypes, type];
    setLocalFilters({ ...localFilters, investmentTypes: types });
  };

  const hasActiveFilters = 
    filters.search || 
    filters.minPrice || 
    filters.maxPrice || 
    filters.bedrooms ||
    filters.bathrooms ||
    filters.investmentTypes.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sticky top-0 z-30">
      {/* Primary Filters */}
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <FiSearch className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={localFilters.search}
            onChange={(e) => setLocalFilters({ ...localFilters, search: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleApply()}
            placeholder="Search location, postcode, or property type..."
            className="block w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl 
                     bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                     placeholder-gray-500 dark:placeholder-gray-400
                     focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                     transition-all duration-200"
          />
          {localFilters.search && (
            <button
              onClick={() => setLocalFilters({ ...localFilters, search: '' })}
              className="absolute inset-y-0 right-0 pr-4 flex items-center"
            >
              <FiX className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Quick Filters Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Min Price */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LuPoundSterling className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="number"
              value={localFilters.minPrice || ''}
              onChange={(e) => setLocalFilters({ 
                ...localFilters, 
                minPrice: e.target.value ? parseInt(e.target.value) : undefined 
              })}
              placeholder="Min price"
              className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl 
                       bg-white dark:bg-gray-900 text-sm
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Max Price */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LuPoundSterling className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="number"
              value={localFilters.maxPrice || ''}
              onChange={(e) => setLocalFilters({ 
                ...localFilters, 
                maxPrice: e.target.value ? parseInt(e.target.value) : undefined 
              })}
              placeholder="Max price"
              className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl 
                       bg-white dark:bg-gray-900 text-sm
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Bedrooms */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LuBedDouble className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="number"
              value={localFilters.bedrooms || ''}
              onChange={(e) => setLocalFilters({ 
                ...localFilters, 
                bedrooms: e.target.value ? parseInt(e.target.value) : undefined 
              })}
              placeholder="Min beds"
              className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl 
                       bg-white dark:bg-gray-900 text-sm
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Bathrooms */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LuBath className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="number"
              value={localFilters.bathrooms || ''}
              onChange={(e) => setLocalFilters({ 
                ...localFilters, 
                bathrooms: e.target.value ? parseInt(e.target.value) : undefined 
              })}
              placeholder="Min baths"
              className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl 
                       bg-white dark:bg-gray-900 text-sm
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
        >
          {showAdvanced ? <LuChevronUp className="h-4 w-4" /> : <LuChevronDown className="h-4 w-4" />}
          {showAdvanced ? 'Hide' : 'Show'} advanced filters
        </button>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            {/* Investment Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Investment Type
              </label>
              <div className="flex flex-wrap gap-2">
                {INVESTMENT_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleInvestmentType(type)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                      ${localFilters.investmentTypes.includes(type)
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg scale-105'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort & Heatmap */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sort by
                </label>
                <select
                  value={localFilters.sort}
                  onChange={(e) => setLocalFilters({ ...localFilters, sort: e.target.value as any })}
                  className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl 
                           bg-white dark:bg-gray-900
                           focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="created_at">Newest</option>
                  <option value="price">Price</option>
                  <option value="bedrooms">Bedrooms</option>
                  <option value="roi_percent">ROI %</option>
                  <option value="yield_percent">Yield %</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Order
                </label>
                <select
                  value={localFilters.sortDirection}
                  onChange={(e) => setLocalFilters({ ...localFilters, sortDirection: e.target.value as any })}
                  className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl 
                           bg-white dark:bg-gray-900
                           focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Map
                </label>
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors h-[42px]">
                  <input
                    type="checkbox"
                    checked={localFilters.heatmap || false}
                    onChange={(e) => setLocalFilters({ ...localFilters, heatmap: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-400"
                    aria-label="Enable heatmap overlay"
                  />
                  <span className="text-sm font-medium">Heatmap</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleApply}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl
                     hover:from-indigo-700 hover:to-purple-700 focus:ring-4 focus:ring-indigo-200 dark:focus:ring-indigo-900
                     transition-all duration-200 shadow-lg hover:shadow-xl text-sm"
          >
            Apply Filters
          </button>
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl
                       hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 text-sm"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
