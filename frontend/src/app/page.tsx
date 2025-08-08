'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import PropertyCard from '../components/PropertyCard';
import { Property } from './types';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

export default function PropertiesPage() {
  // ===== Data =====
  const [properties, setProperties] = useState<Property[]>([]);
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

  // Prefer env over hardcoded URL
  const BACKEND_BASE =
    process.env.NEXT_PUBLIC_API_URL ||
    'https://propnexus-backend-production.up.railway.app';

  // Hide map by default on smaller screens
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setShowMap(false);
    }
  }, []);

  // Fetch listings
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_BASE}/properties`);
        const data = await res.json();
        setProperties(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Error fetching properties:', e);
        setProperties([]);
      }
    })();
  }, [BACKEND_BASE]);

  // Derived filtered list (no extra setState loop)
  const filteredProperties = useMemo(() => {
    const q = searchLocation.trim().toLowerCase();

    return properties.filter((p) => {
      const matchesPrice = (p.price ?? 0) >= minPrice && (p.price ?? 0) <= maxPrice;

      const matchesLocation = q
        ? (p.location ?? '').toLowerCase().includes(q)
        : true;

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
      <div className="sticky-primary">
        <input
          className="filter-input large"
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
        >
          ⚙️ Filters
        </button>

        <button
          onClick={() => setShowMap((v) => !v)}
          className="small-button"
          style={{ backgroundColor: showMap ? '#334155' : '#3b82f6', color: '#fff' }}
          aria-pressed={showMap ? 'true' : 'false'}
        >
          {showMap ? 'Hide Map 🗺️' : 'Show Map 🗺️'}
        </button>

        <button
          className="small-button"
          style={{ marginLeft: 'auto' }}
          onClick={() => document.body.classList.toggle('dark-mode')}
        >
          🌙 Dark Mode
        </button>
      </div>

      {/* ===== Advanced filters ===== */}
      {showMoreFilters && (
        <div className="filters-row">
          <div>
            <label>Min Price</label>
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(Number(e.target.value))}
            />
          </div>

          <div>
            <label>Max Price</label>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
            />
          </div>

          <div>
            <label>Bedrooms</label>
            <select value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}>
              <option value="Any">Any Beds</option>
              <option value="1">1 Bed</option>
              <option value="2">2 Beds</option>
              <option value="3">3 Beds</option>
              <option value="4">4+ Beds</option>
            </select>
          </div>

          <div>
            <label>Property Type</label>
            <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
              <option value="All">All Types</option>
              <option value="Flat">Flat</option>
              <option value="House">House</option>
              <option value="Studio">Studio</option>
            </select>
          </div>

          <div>
            <label>Min Yield (%)</label>
            <input
              type="number"
              value={minYield}
              onChange={(e) => setMinYield(Number(e.target.value))}
            />
          </div>

          <div>
            <label>Min ROI (%)</label>
            <input
              type="number"
              value={minROI}
              onChange={(e) => setMinROI(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* ===== Content: list + optional map ===== */}
      <div className={`content-layout ${showMap ? '' : 'hide-map'}`}>
        <div className="property-list">
          {filteredProperties.length > 0 ? (
            filteredProperties.map((p) => <PropertyCard key={p.id} property={p} />)
          ) : (
            <p style={{ color: '#64748b' }}>No matching properties found.</p>
          )}
        </div>

        {showMap && filteredProperties.length > 0 && (
          <aside className="map-view">
            <MapView properties={filteredProperties} />
          </aside>
        )}
      </div>

      {/* Back to top */}
      <button
        className="back-to-top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        ⬆ Back to Top
      </button>
    </div>
  );
}
