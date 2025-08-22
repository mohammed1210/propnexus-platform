'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import PropertyCard from '../../components/PropertyCard';
import { Property } from '../types';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

// ===== Toast Component =====
function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div
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
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

export default function PropertiesPage() {
  // ===== Data =====
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchLocation, setSearchLocation] = useState('');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(2_000_000);
  const [bedrooms, setBedrooms] = useState<'Any' | string>('Any');
  const [propertyType, setPropertyType] = useState<'All' | string>('All');
  const [investmentType, setInvestmentType] = useState<'All' | string>('All');
  const [minYield, setMinYield] = useState(0);
  const [minROI, setMinROI] = useState(0);

  // ===== UI state =====
  const [showMap, setShowMap] = useState(true);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // ===== Toast state =====
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, []);

  // Prefer env over hardcoded URL
  const BACKEND_BASE = useMemo(
    () =>
      (process.env.NEXT_PUBLIC_API_URL ||
        'https://propnexus-backend-production.up.railway.app'
      ).replace(/\/+$/, ''),
    []
  );

  // Hide map by default on smaller screens & on resize
  useEffect(() => {
    const apply = () => {
      if (typeof window !== 'undefined') setShowMap(window.innerWidth >= 1024);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  // === Fetch helper (wrapped to satisfy eslint deps)
  const fetchProperties = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${BACKEND_BASE}/properties`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // 🔹 Normalize the shape of properties so IDs are consistent
      const normalized = (Array.isArray(data) ? data : []).map((p: any) => ({
        ...p,
        id: p.id ?? p.property_id ?? p.uuid ?? p._id ?? null,
      }));

      setProperties(normalized);
    } catch (e: any) {
      console.error('Error fetching properties:', e);
      setError('Could not load properties. Please try again.');
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, [BACKEND_BASE]);

  // Initial fetch
  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  // 🔄 Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchProperties, 60_000);
    return () => clearInterval(interval);
  }, [fetchProperties]);

  // Unified scrape + search
  const handleSearch = useCallback(async () => {
    if (!searchLocation.trim()) {
      showToast('⚠️ Enter a location first', 'error');
      return;
    }
    try {
      showToast(`🔍 Scraping ${searchLocation}…`, 'success');
      const res = await fetch(`${BACKEND_BASE}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: searchLocation }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // 🔹 Normalize the shape of properties so IDs are consistent
      const normalized = (Array.isArray(data.properties) ? data.properties : []).map((p: any) => ({
        ...p,
        id: p.id ?? p.property_id ?? p.uuid ?? p._id ?? null,
      }));

      setProperties(normalized);
      showToast(`✅ Found ${normalized.length} properties in ${searchLocation}`, 'success');
    } catch (e: any) {
      console.error('Error scraping/searching:', e);
      showToast('❌ Error searching properties. Please try again.', 'error');
    }
  }, [BACKEND_BASE, searchLocation, showToast]);

  // Derived filtered list (no extra setState loop)
  const filteredProperties = useMemo(() => {
    const q = searchLocation.trim().toLowerCase();

    return properties.filter((p) => {
      const price = p.price ?? 0;
      const matchesPrice = price >= minPrice && price <= maxPrice;

      const matchesLocation = q ? (p.location ?? '').toLowerCase().includes(q) : true;
      const matchesBedrooms =
        bedrooms === 'Any' ? true : Number(p.bedrooms) === Number(bedrooms);
      const matchesPropertyType =
        propertyType === 'All'
          ? true
          : (p.propertyType ?? '').toLowerCase() === propertyType.toLowerCase();
      const matchesInvestmentType =
        investmentType === 'All'
          ? true
          : (p.investmentType ?? '').toLowerCase() === investmentType.toLowerCase();
      const matchesYield = (p.yield_percent ?? 0) >= minYield;
      const matchesROI = (p.roi_percent ?? 0) >= minROI;

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
          aria-label="Search location"
        />

        <button onClick={handleSearch} className="small-button" title="Search properties" type="button">
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
          type="button"
        >
          ⚙️ Filters
        </button>

        <button
          onClick={() => setShowMap((v) => !v)}
          className="small-button"
          style={{ backgroundColor: showMap ? '#334155' : '#3b82f6', color: '#fff' }}
          aria-pressed={showMap}
          type="button"
        >
          {showMap ? 'Hide Map 🗺️' : 'Show Map 🗺️'}
        </button>

        <button
          className="small-button"
          style={{ marginLeft: 'auto' }}
          onClick={() => document.body.classList.toggle('dark-mode')}
          aria-label="Toggle dark mode"
          type="button"
        >
          🌙 Dark Mode
        </button>
      </div>

      {/* ===== Advanced filters ===== */}
      {showMoreFilters && (
        <div className="filters-row" role="region" aria-label="Advanced filters">
          {/* Min/Max Price, Beds, Property Type, Yield, ROI */}
          <div>
            <label htmlFor="minPrice">Min Price</label>
            <input
              id="minPrice"
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="maxPrice">Max Price</label>
            <input
              id="maxPrice"
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
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
            />
          </div>
          <div>
            <label htmlFor="minRoi">Min ROI (%)</label>
            <input
              id="minRoi"
              type="number"
              value={minROI}
              onChange={(e) => setMinROI(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* ===== Content: list + optional map ===== */}
      <div className={`content-layout ${showMap ? '' : 'hide-map'}`}>
        <div className="property-list" aria-live="polite">
          {loading && <p style={{ color: '#64748b' }}>Loading properties…</p>}
          {!loading && error && <p style={{ color: '#b91c1c' }}>{error}</p>}
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
        type="button"
      >
        ⬆ Back to Top
      </button>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}