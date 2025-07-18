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
  const [showMap, setShowMap] = useState<boolean>(true); // Map default on for Sprint 3
  const [showMoreFilters, setShowMoreFilters] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/properties')
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
      const matchesLocation = property.location.toLowerCase().includes(searchLocation.toLowerCase());
      const matchesBedrooms = bedrooms === 'Any' || property.bedrooms === Number(bedrooms);
      const matchesPropertyType = propertyType === 'All' || property.propertyType?.toLowerCase() === propertyType.toLowerCase();
      const matchesYield = property.yield_percent >= minYield;
      const matchesROI = property.roi_percent >= minROI;
      const matchesInvestmentType = investmentType === 'All' || property.investmentType?.toLowerCase() === investmentType.toLowerCase();

      return (
        matchesPrice &&
        matchesLocation &&
        matchesBedrooms &&
        matchesPropertyType &&
        matchesYield &&
        matchesROI &&
        matchesInvestmentType
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        padding: '20px',
        gap: '20px',
        backgroundColor: '#f8fafc',
        maxWidth: '100%',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      {/* Left side: Filters + Cards */}
      <div style={{ flex: 1, minWidth: '60%' }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 600,
          marginBottom: '20px',
          backgroundColor: '#e2e8f0',
          padding: '16px 20px',
          borderRadius: '10px',
          color: '#1e293b'
        }}>
          Find Your Next Investment Property
        </h1>

        {/* Filter Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: '#fff',
            padding: '20px',
            border: '1px solid #e5e7eb',
            borderRadius: '10px',
            marginBottom: '20px',
            boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
          }}
        >
          <input
            type="text"
            placeholder="Search location"
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
            style={inputStyle}
          />
          <select
            value={investmentType}
            onChange={(e) => setInvestmentType(e.target.value)}
            style={inputStyle}
          >
            <option value="All">All Investment Types</option>
            <option value="HMO">HMO</option>
            <option value="Flips">Flips</option>
            <option value="Buy to Let">Buy to Let</option>
          </select>
          <button
            onClick={() => setShowMoreFilters(!showMoreFilters)}
            style={buttonStyle}
          >
            {showMoreFilters ? 'Hide Filters' : 'More Filters'}
          </button>
          <button
            onClick={() => setShowMap(!showMap)}
            style={{
              ...buttonStyle,
              backgroundColor: showMap ? '#334155' : '#3b82f6',
              color: '#fff',
              flex: '1 1 120px'
            }}
          >
            {showMap ? 'Hide Map' : 'Show Map'}
          </button>

          {showMoreFilters && (
            <>
              <input type="number" placeholder="Min Price" value={minPrice} onChange={(e) => setMinPrice(Number(e.target.value))} style={inputStyle} />
              <input type="number" placeholder="Max Price" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} style={inputStyle} />
              <select value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} style={inputStyle}>
                <option value="Any">Any Beds</option>
                <option value="1">1 Bed</option>
                <option value="2">2 Beds</option>
                <option value="3">3 Beds</option>
                <option value="4">4+ Beds</option>
              </select>
              <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} style={inputStyle}>
                <option value="All">All Types</option>
                <option value="Flat">Flat</option>
                <option value="House">House</option>
                <option value="Studio">Studio</option>
              </select>
              <input type="number" placeholder="Min Yield (%)" value={minYield} onChange={(e) => setMinYield(Number(e.target.value))} style={inputStyle} />
              <input type="number" placeholder="Min ROI (%)" value={minROI} onChange={(e) => setMinROI(Number(e.target.value))} style={inputStyle} />
            </>
          )}
        </div>

        {/* Property Cards */}
        {filteredProperties.length > 0 ? (
          filteredProperties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))
        ) : (
          <p style={{ color: '#64748b' }}>No matching properties found.</p>
        )}
      </div>

      {/* Right side: Map */}
      {showMap && (
        <div style={{
          flex: '0 0 40%',
          minHeight: '80vh',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          <MapView properties={filteredProperties} />
        </div>
      )}
    </div>
  );
}

// Reusable input and button styles
const inputStyle = {
  flex: '1 1 160px',
  padding: '10px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
};

const buttonStyle = {
  flex: '1 1 140px',
  padding: '10px 14px',
  backgroundColor: '#e2e8f0',
  color: '#1e293b',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontWeight: '500',
  cursor: 'pointer',
};
