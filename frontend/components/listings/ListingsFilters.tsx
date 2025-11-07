'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiSearch, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { LuPoundSterling, LuBedDouble, LuBath } from 'react-icons/lu';

const INVESTMENT_TYPES = ['HMO', 'BTL', 'SA', 'BRR', 'Flip', 'Commercial'] as const;
type InvestmentType = (typeof INVESTMENT_TYPES)[number];

const SORTABLE = ['created_at', 'price', 'bedrooms', 'roi_percent', 'yield_percent'] as const;
type SortKey = (typeof SORTABLE)[number];

export default function ListingsFilters() {
  const sp = useSearchParams();
  const router = useRouter();

  const [isExpanded, setIsExpanded] = useState(true);
  // Sprint 11.3: More filters toggle (collapsed by default)
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(
    sp?.get('more') === '1' || false
  );

  // Parse initial state from URL
  const qInit = sp?.get('q') ?? '';
  const minInit = sp?.get('min') ?? '';
  const maxInit = sp?.get('max') ?? '';
  const bedsInit = sp?.get('beds') ?? '';
  const bathsInit = sp?.get('baths') ?? '';
  const sortInit = (sp?.get('sort') as SortKey) || 'created_at';
  const dirInit = sp?.get('dir') === 'asc' ? 'asc' : 'desc';
  const heatmapInit = sp?.get('heatmap') === '1';
  const typesInit = sp?.get('types')?.split(',').filter(Boolean) ?? [];

  const [q, setQ] = useState(qInit);
  const [min, setMin] = useState(minInit);
  const [max, setMax] = useState(maxInit);
  const [beds, setBeds] = useState(bedsInit);
  const [baths, setBaths] = useState(bathsInit);
  const [sort, setSort] = useState<SortKey>(sortInit);
  const [dir, setDir] = useState<'asc' | 'desc'>(dirInit);
  const [heatmap, setHeatmap] = useState(heatmapInit);
  const [selectedTypes, setSelectedTypes] = useState<InvestmentType[]>(typesInit as InvestmentType[]);

  const toggleType = useCallback((type: InvestmentType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  const toggleDir = useCallback(() => {
    setDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  const apply = useCallback(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (min) p.set('min', min);
    if (max) p.set('max', max);
    if (beds) p.set('beds', beds);
    if (baths) p.set('baths', baths);
    if (sort) p.set('sort', sort);
    if (dir) p.set('dir', dir);
    if (heatmap) p.set('heatmap', '1');
    if (selectedTypes.length > 0) p.set('types', selectedTypes.join(','));
    if (moreFiltersOpen) p.set('more', '1');
    router.push(`/listings?${p.toString()}`);
  }, [q, min, max, beds, baths, sort, dir, heatmap, selectedTypes, moreFiltersOpen, router]);

  const reset = useCallback(() => {
    setQ('');
    setMin('');
    setMax('');
    setBeds('');
    setBaths('');
    setSort('created_at');
    setDir('desc');
    setHeatmap(false);
    setSelectedTypes([]);
    setMoreFiltersOpen(false);
    router.push('/listings');
  }, [router]);

  return (
    <div className="border-b bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm sticky top-[var(--header-h)] z-20">
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* Mobile toggle button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="md:hidden w-full flex items-center justify-between px-4 py-2 rounded-lg border bg-white dark:bg-zinc-900 mb-3"
          aria-expanded={isExpanded}
          aria-controls="filters-panel"
        >
          <span className="font-medium">Filters</span>
          {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
        </button>

        {/* Filters panel */}
        <div
          id="filters-panel"
          className={`space-y-3 ${!isExpanded ? 'hidden md:block' : 'block'}`}
        >
          {/* Primary filters: Search + Budget + Beds + Baths - always visible */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white dark:bg-zinc-900">
              <FiSearch className="opacity-60" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search area, title, or postcode"
                className="w-full bg-transparent outline-none"
                aria-label="Search by area, title, or postcode"
              />
            </div>

            <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white dark:bg-zinc-900">
              <LuPoundSterling className="opacity-60" aria-hidden />
              <input
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder="Min price"
                inputMode="numeric"
                className="w-full bg-transparent outline-none"
                aria-label="Minimum price"
              />
            </div>

            <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white dark:bg-zinc-900">
              <LuPoundSterling className="opacity-60" aria-hidden />
              <input
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder="Max price"
                inputMode="numeric"
                className="w-full bg-transparent outline-none"
                aria-label="Maximum price"
              />
            </div>

            <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white dark:bg-zinc-900">
              <LuBedDouble className="opacity-60" aria-hidden />
              <input
                value={beds}
                onChange={(e) => setBeds(e.target.value)}
                placeholder="Any beds"
                inputMode="numeric"
                className="w-full bg-transparent outline-none"
                aria-label="Minimum bedrooms"
              />
            </div>

            <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white dark:bg-zinc-900">
              <LuBath className="opacity-60" aria-hidden />
              <input
                value={baths}
                onChange={(e) => setBaths(e.target.value)}
                placeholder="Any baths"
                inputMode="numeric"
                className="w-full bg-transparent outline-none"
                aria-label="Minimum bathrooms"
              />
            </div>
          </div>

          {/* Sprint 11.3: More Filters Toggle */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMoreFiltersOpen(!moreFiltersOpen)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors"
              aria-expanded={moreFiltersOpen}
              aria-controls="more-filters-section"
            >
              {moreFiltersOpen ? <FiChevronUp /> : <FiChevronDown />}
              <span>More filters</span>
            </button>

            <div className="flex gap-2">
              <button
                onClick={apply}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                Apply
              </button>
              <button
                onClick={reset}
                className="px-4 py-2 rounded-xl border bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                aria-label="Reset all filters"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Secondary filters - collapsible */}
          {moreFiltersOpen && (
            <div id="more-filters-section" className="space-y-3 pt-2 border-t">
              {/* Investment Types */}
              <div>
                <label className="block text-sm font-medium mb-2" id="investment-types-label">
                  Investment Type
                </label>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-labelledby="investment-types-label"
                >
                  {INVESTMENT_TYPES.map((type) => {
                    const isSelected = selectedTypes.includes(type);
                    return (
                      <button
                        key={type}
                        onClick={() => toggleType(type)}
                        className={`
                          px-4 py-2 rounded-full border text-sm font-medium
                          transition-all duration-200 transform
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
                          ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 scale-105 shadow-md'
                              : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 hover:border-indigo-400 hover:scale-105'
                          }
                        `}
                        aria-pressed={isSelected}
                        aria-label={`${type} investment type`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sort + Direction + Heatmap */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                <div className="col-span-2">
                  <label htmlFor="sort-field" className="block text-sm font-medium mb-1">
                    Sort by
                  </label>
                  <select
                    id="sort-field"
                    value={sort}
                    onChange={(e) => setSort((e.target.value as SortKey) || 'created_at')}
                    className="w-full border rounded-xl px-3 py-2 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="created_at">Newest</option>
                    <option value="price">Price</option>
                    <option value="bedrooms">Bedrooms</option>
                    <option value="roi_percent">ROI %</option>
                    <option value="yield_percent">Yield %</option>
                  </select>
                </div>

                <button
                  onClick={toggleDir}
                  className="px-4 py-2 rounded-xl border bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  aria-label={`Sort direction: ${dir === 'asc' ? 'Ascending' : 'Descending'}`}
                >
                  {dir === 'asc' ? '↑ Asc' : '↓ Desc'}
                </button>

                <div>
                  <label className="flex items-center gap-2 px-4 py-2 rounded-xl border bg-white dark:bg-zinc-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={heatmap}
                      onChange={(e) => setHeatmap(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-400"
                      aria-label="Enable heatmap overlay"
                    />
                    <span className="text-sm font-medium">Heatmap</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
