'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import PropertyCard from '../../components/PropertyCard';
import { Property } from '../types';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

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
  const [scraping, setScraping] = useState<'rightmove' | 'zoopla' | null>(null);

  // Prefer env over hardcoded URL
  const BACKEND_BASE =
    (process.env.NEXT_PUBLIC_API_URL ||
      'https://propnexus-backend-production.up.railway.app').replace(/\/+$/, '');

  // Hide map by default on smaller screens & on resize
  useEffect(() => {
    const apply = () => {
      if (typeof window !== 'undefined') setShowMap(window.innerWidth >= 1024);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  // Fetch listings
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${BACKEND_BASE}/properties`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!active) return;
        setProperties(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!active) return;
        console.error('Error fetching properties:', e);
        setError('Could not load properties. Please try again.');
        setProperties([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [BACKEND_BASE]);

  // Derived filtered list
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

  // ===== Scraper action =====
  async function runScraper(type: 'rightmove' | 'zoopla') {
    try {
      setScraping(type);
      const res = await fetch(`${BACKEND_BASE}/scrape-${type}`, { method: 'POST' });
      const data = await res.json();
      alert(
        `✅ ${type.charAt(0).toUpperCase() + type.slice(1)} scrape done: ${
          data.data?.length || 0
        } properties fetched`
      );
    } catch (err) {
      console.error(`${type} scrape failed:`, err);
      alert(`❌ ${type} scrape failed. Check console/logs.`);
    } finally {
      setScraping(null);
    }
  }

  return (
    <div className="main-wrapper">
      {/* ===== Filters (sticky) ===== */}
      <div className="sticky-primary" role="region" aria-label="Filters">
        <input
          className="filter-input large"
          style={{ flex: '0 1 48%' }}
          type="text"
          placeholder="🔎 Search location"
          value={searchLocation}
          onChange={(e) => setSearchLocation(e.target.value)}
          aria-label="Search location"
        />

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

      {/* ===== Scraper controls ===== */}
      <div
        className="scraper-controls"
        style={{ margin: '1rem 0', display: 'flex', gap: '0.5rem' }}
      >
        <button
          className="small-button"
          disabled={!!scraping}
          onClick={() => runScraper('rightmove')}
        >
          {scraping === 'rightmove' ? '⏳ Scraping Rightmove…' : '🔄 Scrape Rightmove'}
        </button>

        <button
          className="small-button"
          disabled={!!scraping}
          onClick={() => runScraper('zoopla')}
        >
          {scraping === 'zoopla' ? '⏳ Scraping Zoopla…' : '🔄 Scrape Zoopla'}
        </button>
      </div>

      {/* ===== Fullscreen overlay when scraping ===== */}
      {scraping && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            fontSize: '1.5rem',
            fontWeight: 'bold',
          }}
        >
          {scraping === 'rightmove' ? 'Scraping Rightmove…' : 'Scraping Zoopla…'}
        </div>
      )}

      {/* ===== Advanced filters ===== */}
      {showMoreFilters && (
        <div className="filters-row" role="region" aria-label="Advanced filters">
          {/* ... existing advanced filter inputs ... */}
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
      >
        ⬆ Back to Top
      </button>
    </div>
  );
}