'use client';

import { useEffect, useState } from 'react';
import { Property } from '../types';
import PropertyCard from '@components/PropertyCard';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(2000000);
  const [searchLocation, setSearchLocation] = useState<string>('');
  const [bedrooms, setBedrooms] = useState<string>('Any');
  const [propertyType, setPropertyType] = useState<string>('All');
  const [investmentType, setInvestmentType] = useState<string>('All');
  const [minYield, setMinYield] = useState<number>(0);
  const [minROI, setMinROI] = useState<number>(0);
  const [showMap, setShowMap] = useState<boolean>(true);
  const [showMoreFilters, setShowMoreFilters] = useState<boolean>(false);

  useEffect(() => {
    fetch("https://propnexus-backend-production.up.railway.app/properties")
      .then((res) => res.json())
      .then((data) => {
        setProperties(data);
        setFilteredProperties(data);
      })
      .catch((err) => console.error('Error fetching properties:', err));
  }, []);

  useEffect(() => {
    const filtered = properties.filter((property) => {
      const matchesPrice = property.price >= minPrice && property.price <= maxPrice;
      const matchesLocation = property.location?.toLowerCase().includes(searchLocation.toLowerCase());
      const matchesBedrooms = bedrooms === 'Any' || Number(property.bedrooms) === Number(bedrooms);
      const matchesPropertyType =
        propertyType === 'All' || (property.propertyType || '').toLowerCase() === propertyType.toLowerCase();
      const matchesYield = (property.yield_percent || 0) >= minYield;
      const matchesROI = (property.roi_percent || 0) >= minROI;
      return (
        matchesPrice &&
        matchesLocation &&
        matchesBedrooms &&
        matchesPropertyType &&
        matchesYield &&
        matchesROI
      );
    });
    setFilteredProperties(filtered);
  }, [
    minPrice, maxPrice, searchLocation, properties,
    bedrooms, propertyType, minYield, minROI, investmentType,
  ]);

  return (
    <div className="main-wrapper">
      {/* 🔗 Unified Header */}
      <div style={{ background: '#f1f5f9', padding: '10px 20px' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#0f172a' }}>PropNexus</h1>
      </div>

      {/* 📌 Filters Bar */}
      <div className="filters-row">
        <input
          type="text"
          placeholder="Search location"
          value={searchLocation}
          onChange={(e) => setSearchLocation(e.target.value)}
          style={{ minHeight: '38px' }}
        />

        <select value={investmentType} onChange={(e) => setInvestmentType(e.target.value)} style={{ minHeight: '38px' }}>
          <option value="All">💼 All Investment Types</option>
          <option value="HMO">🏘️ HMO</option>
          <option value="Flips">🔁 Flips</option>
          <option value="Buy to Let">🏠 Buy to Let</option>
        </select>

        <button
          onClick={() => setShowMoreFilters(!showMoreFilters)}
          style={{ minHeight: '38px' }}
        >
          {showMoreFilters ? 'Hide Filters' : 'More Filters'}
        </button>

        <button
          onClick={() => setShowMap(!showMap)}
          className="map-toggle-button"
          style={{
            minHeight: '38px',
            backgroundColor: showMap ? '#334155' : '#3b82f6',
            color: '#fff',
          }}
        >
          {showMap ? 'Hide Map 🗺' : 'Show Map 🗺'}
        </button>

        {showMoreFilters && (
          <>
            <div>
              <label>Min Price</label>
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(Number(e.target.value))}
                style={{ minHeight: '38px' }}
              />
            </div>

            <div>
              <label>Max Price</label>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                style={{ minHeight: '38px' }}
              />
            </div>

            <select
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              style={{ minHeight: '38px' }}
            >
              <option value="Any">🛏️ Any Beds</option>
              <option value="1">🛏️ 1 Bed</option>
              <option value="2">🛏️ 2 Beds</option>
              <option value="3">🛏️ 3 Beds</option>
              <option value="4">🛏️ 4+ Beds</option>
            </select>

            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              style={{ minHeight: '38px' }}
            >
              <option value="All">🏡 All Types</option>
              <option value="Flat">🏢 Flat</option>
              <option value="House">🏠 House</option>
              <option value="Studio">📦 Studio</option>
            </select>

            <input
              type="number"
              placeholder="Min Yield (%)"
              value={minYield}
              onChange={(e) => setMinYield(Number(e.target.value))}
              style={{ minHeight: '38px' }}
            />

            <input
              type="number"
              placeholder="Min ROI (%)"
              value={minROI}
              onChange={(e) => setMinROI(Number(e.target.value))}
              style={{ minHeight: '38px' }}
            />
          </>
        )}
      </div>

      {/* 💡 Results + Map */}
      <div className="content-layout">
        <div className="property-list">
          {filteredProperties.length > 0 ? (
            filteredProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))
          ) : (
            <p style={{ color: '#64748b' }}>No matching properties found.</p>
          )}
        </div>

        {showMap && (
          <div className="map-view">
            <MapView properties={filteredProperties} />
          </div>
        )}
      </div>
    </div>
  );
}
