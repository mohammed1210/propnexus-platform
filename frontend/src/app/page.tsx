'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import PropertyCard from '../../components/PropertyCard';
import { Property } from '../types';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

/* ------------------------------- Toast UI ------------------------------- */
function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: type === 'success' ? '#16a34a' : '#dc2626',
        color: 'white',
        padding: '10px 16px',
        borderRadius: '6px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        zIndex: 1000,
      }}
    >
      {message}
    </div>
  );
}

/* ------------------------------ Page Component ------------------------------ */
export default function PropertiesPage() {
  /* Data */
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Filters */
  const [searchLocation, setSearchLocation] = useState('');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(2_000_000);
  const [bedrooms, setBedrooms] = useState<'Any' | string>('Any');
  const [propertyType, setPropertyType] = useState<'All' | string>('All');
  const [investmentType, setInvestmentType] = useState<'All' | string>('All');
  const [minYield, setMinYield] = useState(0);
  const [minROI, setMinROI] = useState(0);

  /* UI state */
  const [showMap, setShowMap] = useState(true);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  /* Toast */
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  /* Derived config */
  const BACKEND_BASE = (
    process.env.NEXT_PUBLIC_API_URL || 'https://propnexus-backend-production.up.railway.app'
  ).replace(/\/+$/, '');

  /* Persist map toggle across sessions + hide by default on small screens */
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('pn:showMap') : null;
    if (saved !== null) {
      setShowMap(saved === '1');
    } else if (typeof window !== 'undefined') {
      setShowMap(window.innerWidth >= 1024);
    }
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('pn:showMap', showMap ? '1' : '0');
    }
  }, [showMap]);
  useEffect(() => {
    const onResize = () => {
      // only auto-hide when there’s no explicit user preference saved
      const saved = window.localStorage.getItem('pn:showMap');
      if (saved === null) setShowMap(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* Fetch helpers with AbortController (avoid race conditions) */
  const listAbortRef = useRef<AbortController | null>(null);

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    setError(null);

    listAbortRef.current?.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;

    try {
      const res = await fetch(`${BACKEND_BASE}/properties`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`List failed: HTTP ${res.status}`);
      }

      const data = await res.json();
      setProperties(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.error('Error fetching properties:', e);
      setError('Could not load properties. Please try again.');
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, [BACKEND_BASE]);

  /* Initial fetch + periodic refresh */
  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    const id = window.setInterval(fetchProperties, 60_000);
    return () => window.clearInterval(id);
  }, [fetchProperties]);

  /* Unified scrape + search */
  const handleSearch = useCallback(async () => {
    const q = searchLocation.trim();
    if (!q) {
      showToast('⚠️ Enter a location first', 'error');
      return;
    }

    try {
      showToast(`🔍 Scraping ${q}…`, 'success');

      const res = await fetch(`${BACKEND_BASE}/scrape`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ location: q }),
      });

      if (!res.ok) throw new Error(`Scrape failed: HTTP ${res.status}`);

      const data = await res.json();
      const list: Property[] = Array.isArray(data?.properties) ? data.properties : [];
      setProperties(list);

      const count =
        typeof data?.count === 'number'
          ? data.count
          : Array.isArray(data?.properties)
          ? data.properties.length
          : 0;

      showToast(`✅ Found ${count} properties in ${q}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('❌ Scrape failed. Please try again.', 'error');
    }
  }, [BACKEND_BASE, searchLocation]);

  /* Filtered results (memoized) */
  const filteredProperties = useMemo(() => {
    const q = searchLocation.trim().toLowerCase();

    return properties.filter((p) => {
      const price = Number(p.price ?? 0);
      const matchesPrice = price >= minPrice && price <= maxPrice;

      const matchesLocation = q ? String(p.location ?? '').toLowerCase().includes(q) : true;
      const matchesBedrooms =
        bedrooms === 'Any' ? true : Number(p.bedrooms) === Number(bedrooms);

      const matchesPropertyType =
        propertyType === 'All'
          ? true
          : String(p.propertyType ?? '').toLowerCase() === propertyType.toLowerCase();

      const matchesInvestmentType =
        investmentType === 'All'
          ? true
          : String(p.investmentType ?? '').toLowerCase() === investmentType.toLowerCase();

      const matchesYield = Number(p.yield_percent ?? 0) >= minYield;
      const matchesROI = Number(p.roi_percent ?? 0) >= minROI;

      return (
        matchesPrice &&
        matchesLocation &&
        matchesBedrooms &&
        matchesPropertyType &&
        matchesInvestmentType &&
        matchesYield &&
        matchesROI
      );
    });
  }, [
    properties,
    searchLocation,
    minPrice,
    maxPrice,
    bedrooms,
    propertyType,
    investmentType,
    minYield,
    minROI,
  ]);

  /* Small loading skeleton while first load runs */
  const Skeleton = () => (
    <div style={{ display: 'grid', gap: '12px' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ height: 120, background: '#e5e7eb', borderRadius: 12 }} />
      ))}
    </div>
  );

  return (
    <div className="main-wrapper">
      {/* ===== Filters (sticky) ===== */}
      <div className="sticky-primary" role="region" aria-label="Filters">
        <input
          className="filter-input large"
          style={{ flex: '0 1 40%' }}
          type="text"
          placeholder="🔎 Search location"
          value={searchLocation}
          onChange={(e) => setSearchLocation(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          aria-label="Search location"
        />

        <button onClick={handleSearch} className="small-button" title="Search properties">
          🔍 Search
        </button>

        <select
          className="filter-select small"
          value={investmentType}
          onChange={(e) => setInvestmentType(e.target.value)}
          aria-label="Investment type"
        >
          <option value="All">All Investment Types</option>
          <option value="HMO">HMO</option>
          <option value="Flips">Flips</option>
          <option value="Buy to Let">Buy to Let</option>
          <option value="Joint venture">Joint venture</option>
        </select>

        <button
          onClick={() => setShowMoreFilters((v) => !v)}
          className="small-button"
          title="Show more filters"
          aria-expanded={showMoreFilters}
          aria-controls="advanced-filters"
        >
          ⚙️ Filters
        </button>

        <button
          onClick={() => setShowMap((v) => !v)}
          className="small-button"
          style={{ backgroundColor: showMap ? '#334155' : '#3b82f6', color: '#fff' }}
          aria-pressed={showMap}
        >
          {showMap ? 'Hide Map 🗺️' : 'Show Map 🗺️'}
        </button>

        <button
          className="small-button"
          style={{ marginLeft: 'auto' }}
          onClick={() => document.body.classList.toggle('dark-mode')}
          aria-label="Toggle dark mode"
        >
          🌙 Dark Mode
        </button>
      </div>

      {/* ===== Advanced filters ===== */}
      {showMoreFilters && (
        <div
          id="advanced-filters"
          className="filters-row"
          role="region"
          aria-label="Advanced filters"
        >
          <div>
            <label htmlFor="minPrice">Min Price</label>
            <input
              id="minPrice"
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(Number(e.target.value))}
              min={0}
            />
          </div>
          <div>
            <label htmlFor="maxPrice">Max Price</label>
            <input
              id="maxPrice"
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              min={0}
            />
          </div>
          <div>
            <label htmlFor="beds">Bedrooms</label>
            <select id="beds" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}>
              <option value="Any">Any Beds</option>
              <option value="1">1 Bed</option>
              <option value="2">2 Beds</option>
              <option value="3">3 Beds</option>
              <option value="4">4+ Beds</option>
            </select>
          </div>
          <div>
            <label htmlFor="ptype">Property Type</label>
            <select
              id="ptype"
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
            >
              <option value="All">All Types</option>
              <option value="Flat">Flat</option>
              <option value="House">House</option>
              <option value="Studio">Studio</option>
            </select>
          </div>
          <div>
            <label htmlFor="minYield">Min Yield (%)</label>
            <input
              id="minYield"
              type="number"
              value={minYield}
              onChange={(e) => setMinYield(Number(e.target.value))}
              min={0}
            />
          </div>
          <div>
            <label htmlFor="minRoi">Min ROI (%)</label>
            <input
              id="minRoi"
              type="number"
              value={minROI}
              onChange={(e) => setMinROI(Number(e.target.value))}
              min={0}
            />
          </div>
        </div>
      )}

      {/* ===== Content: list + optional map ===== */}
      <div className={`content-layout ${showMap ? '' : 'hide-map'}`}>
        <div className="property-list" aria-live="polite">
          {loading && <Skeleton />}
          {!loading && error && <p style={{ color: '#b91c1c' }}>{error}</p>}

          {!loading && !error && (
            <p style={{ color: '#64748b', marginBottom: 12 }}>
              Showing <strong>{filteredProperties.length}</strong> result
              {filteredProperties.length === 1 ? '' : 's'}
            </p>
          )}

          {!loading && !error && filteredProperties.length === 0 && (
            <p style={{ color: '#64748b' }}>No matching properties found.</p>
          )}

          {!loading &&
            !error &&
            filteredProperties.map((p) => <PropertyCard key={p.id} property={p} />)}
        </div>

        {showMap && filteredProperties.length > 0 && (
          <aside className="map-view">
            <div className="map-panel">
              <MapView properties={filteredProperties} />
            </div>
          </aside>
        )}
      </div>

      {/* Back to top */}
      <button
        className="back-to-top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
      >
        ⬆ Back to Top
      </button>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
