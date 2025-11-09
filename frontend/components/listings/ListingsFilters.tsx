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
    <div className="border-b backdrop-blur-sm sticky top-[var(--header-h)] z-20" style={{ 
      borderColor: 'var(--border-primary)',
      background: 'var(--card-bg)'
    }}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* Mobile toggle button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="md:hidden w-full flex items-center justify-between px-4 py-2 rounded-lg mb-3 card"
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
            <div className="flex items-center gap-2 rounded-xl px-3 input-field h-[44px]">
              <FiSearch className="opacity-60 flex-shrink-0" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search area, title, or postcode"
                className="w-full bg-transparent outline-none"
                style={{ color: 'var(--text-primary)' }}
                aria-label="Search by area, title, or postcode"
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl px-3 input-field h-[44px]">
              <LuPoundSterling className="opacity-60 flex-shrink-0" aria-hidden />
              <input
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder="Min price"
                inputMode="numeric"
                className="w-full bg-transparent outline-none"
                style={{ color: 'var(--text-primary)' }}
                aria-label="Minimum price"
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl px-3 input-field h-[44px]">
              <LuPoundSterling className="opacity-60 flex-shrink-0" aria-hidden />
              <input
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder="Max price"
                inputMode="numeric"
                className="w-full bg-transparent outline-none"
                style={{ color: 'var(--text-primary)' }}
                aria-label="Maximum price"
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl px-3 input-field h-[44px]">
              <LuBedDouble className="opacity-60 flex-shrink-0" aria-hidden />
              <input
                value={beds}
                onChange={(e) => setBeds(e.target.value)}
                placeholder="Any beds"
                inputMode="numeric"
                className="w-full bg-transparent outline-none"
                style={{ color: 'var(--text-primary)' }}
                aria-label="Minimum bedrooms"
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl px-3 input-field h-[44px]">
              <LuBath className="opacity-60 flex-shrink-0" aria-hidden />
              <input
                value={baths}
                onChange={(e) => setBaths(e.target.value)}
                placeholder="Any baths"
                inputMode="numeric"
                className="w-full bg-transparent outline-none"
                style={{ color: 'var(--text-primary)' }}
                aria-label="Minimum bathrooms"
              />
            </div>
          </div>

          {/* Sprint 11.3: More Filters Toggle */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMoreFiltersOpen(!moreFiltersOpen)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors"
              style={{ color: 'var(--accent-primary)' }}
              aria-expanded={moreFiltersOpen}
              aria-controls="more-filters-section"
            >
              {moreFiltersOpen ? <FiChevronUp /> : <FiChevronDown />}
              <span>More filters</span>
            </button>

            <div className="flex gap-2">
              <button
                onClick={apply}
                className="px-4 rounded-xl btn-primary h-[44px] font-semibold"
              >
                Apply
              </button>
              <button
                onClick={reset}
                className="px-4 rounded-xl surface-panel transition-colors focus:outline-none h-[44px] font-medium"
                aria-label="Reset all filters"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Secondary filters - collapsible */}
          {moreFiltersOpen && (
            <div id="more-filters-section" className="space-y-3 pt-2" style={{ borderTop: '1px solid var(--border-secondary)' }}>
              {/* Investment Types - Pill/Tag Style */}
              <div>
                <label className="block text-sm font-medium mb-3" id="investment-types-label" style={{ color: 'var(--text-secondary)' }}>
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
                          px-4 py-2 h-[44px] rounded-full text-sm font-semibold
                          transition-all duration-200 ease-out
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                          ${
                            isSelected
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg scale-105 focus-visible:ring-indigo-400'
                              : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md hover:scale-102 focus-visible:ring-gray-400'
                          }
                        `}
                        style={{
                          transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                        }}
                        aria-pressed={isSelected}
                        aria-label={`${type} investment type${isSelected ? ', selected' : ''}`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sort + Direction + Heatmap */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-center">
                <div className="col-span-2">
                  <label htmlFor="sort-field" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Sort by
                  </label>
                  <select
                    id="sort-field"
                    value={sort}
                    onChange={(e) => setSort((e.target.value as SortKey) || 'created_at')}
                    className="w-full border rounded-xl px-3 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-indigo-400 h-[44px] font-medium"
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
                  className="px-4 rounded-xl border bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 h-[44px] font-semibold"
                  aria-label={`Sort direction: ${dir === 'asc' ? 'Ascending' : 'Descending'}`}
                >
                  {dir === 'asc' ? '↑ Asc' : '↓ Desc'}
                </button>

                <label className="flex items-center gap-2 px-4 rounded-xl border bg-white dark:bg-zinc-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors h-[44px]">
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
          )}
        </div>
      </div>
    </div>
  );
}
