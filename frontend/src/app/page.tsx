'use client';

import { useEffect, useState } from 'react';
import { Property } from '../types';
import PropertyCard from '../../components/PropertyCard';
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
      const matchesPrice =
        property.price >= minPrice && property.price <= maxPrice;

      const matchesLocation = property.location
        ?.toLowerCase()
        .includes(searchLocation.toLowerCase());

      const matchesBedrooms =
        bedrooms === 'Any' || Number(property.bedrooms) === Number(bedrooms);

      const matchesPropertyType =
        propertyType === 'All' ||
        (property.propertyType || '').toLowerCase() === propertyType.toLowerCase();

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
    minPrice,
    maxPrice,
    searchLocation,
    properties,
    bedrooms,
    propertyType,
    minYield,
    minROI,
    investmentType,
  ]);

  return (
    <div className="main-wrapper">
      {/* 🔝 Sticky container for header + filters */}
      <div className="sticky-top-header">
        <header className="header-bar">
          <h1 className="header-title">PropNexus</h1>
          <button
            className="mode-toggle"
            onClick={() => document.body.classList.toggle('dark-mode')}
          >
            🌙 Dark Mode
          </button>
        </header>

        {/* 🔍 Quick Filters */}
        <div className="sticky-primary">
          <input
            className="filter-input"
            type="text"
            placeholder="🔎 Search location"
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
          />

          <select
            className="filter-select small"
            value={investmentType}
            onChange={(e) => setInvestmentType(e.target.value)}
          >
            <option value="All">All Investment Types</option>
            <option value="HMO">HMO</option>
            <option value="Flips">Flips</option>
            <option value="Buy to Let">Buy to Let</option>
          </select>

          <button
            onClick={() => setShowMoreFilters(!showMoreFilters)}
            className="small-button"
            title="Show more filters"
          >
            ⚙️ Filters
          </button>

          <button
            onClick={() => setShowMap(!showMap)}
            className="map-toggle-button"
            style={{
              backgroundColor: showMap ? '#334155' : '#3b82f6',
              color: '#fff',
            }}
          >
            {showMap ? 'Hide Map 🗺' : 'Show Map 🗺'}
          </button>
        </div>
      </div>

      {/* 🎛️ Advanced Filters */}
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
            <select
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
            >
              <option value="Any">Any Beds</option>
              <option value="1">1 Bed</option>
              <option value="2">2 Beds</option>
              <option value="3">3 Beds</option>
              <option value="4">4+ Beds</option>
            </select>
          </div>

          <div>
            <label>Property Type</label>
            <select
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

      {/* 🏘️ Property + Map View */}
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

        {showMap && filteredProperties.length > 0 && (
          <div className="map-view mt-8">
            <MapView properties={filteredProperties} />
          </div>
        )}
      </div>
    </div>
  );
}