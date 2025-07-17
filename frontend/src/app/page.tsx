'use client';

import { useEffect, useState } from 'react';
import PropertyCard from '../../components/PropertyCard';
import MapView from './MapView';

interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  bedrooms: number;
  bathrooms: number;
  description: string;
  imageurl: string;
  yield_percent: number;
  roi_percent: number;
  source: string;
  created_at: string;
  latitude: number;
  longitude: number;
  propertyType: string;
  investmentType: string;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(2000000);
  const [searchLocation, setSearchLocation] = useState<string>('');
  const [bedrooms, setBedrooms] = useState<string>('Any');
  const [propertyType, setPropertyType] = useState<string>('All');
  const [showMap, setShowMap] = useState<boolean>(false);

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
      const matchesPrice =
        property.price >= minPrice && property.price <= maxPrice;
      const matchesLocation = property.location
        .toLowerCase()
        .includes(searchLocation.toLowerCase());
      const matchesBedrooms =
        bedrooms === 'Any' || property.bedrooms === Number(bedrooms);
      const matchesPropertyType =
        propertyType === 'All' ||
        property.propertyType.toLowerCase() === propertyType.toLowerCase();

      return (
        matchesPrice &&
        matchesLocation &&
        matchesBedrooms &&
        matchesPropertyType
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
  ]);

  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: '#f9fafb',
        minHeight: '100vh',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      <h1
        style={{
          marginBottom: '20px',
          backgroundColor: '#e2e8f0', // darker slate background
          padding: '16px 20px',
          borderRadius: '10px',
          fontSize: '24px',
          fontWeight: '600',
          color: '#1e293b',
        }}
      >
        Prop-Nexus
      </h1>

      <div
        style={{
          backgroundColor: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '10px',
          padding: '20px',
          boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <input
          type="text"
          placeholder="Search by location"
          value={searchLocation}
          onChange={(e) => setSearchLocation(e.target.value)}
          style={{
            flex: '1 1 200px',
            padding: '10px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
          }}
        />
        <input
          type="number"
          placeholder="Min Price"
          value={minPrice}
          onChange={(e) => setMinPrice(Number(e.target.value))}
          style={{
            flex: '1 1 120px',
            padding: '10px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
          }}
        />
        <input
          type="number"
          placeholder="Max Price"
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          style={{
            flex: '1 1 120px',
            padding: '10px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
          }}
        />
        <select
          value={bedrooms}
          onChange={(e) => setBedrooms(e.target.value)}
          style={{
            flex: '1 1 120px',
            padding: '10px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
          }}
        >
          <option value="Any">Any Beds</option>
          <option value="1">1 Bed</option>
          <option value="2">2 Beds</option>
          <option value="3">3 Beds</option>
          <option value="4">4+ Beds</option>
        </select>
        <select
          value={propertyType}
          onChange={(e) => setPropertyType(e.target.value)}
          style={{
            flex: '1 1 140px',
            padding: '10px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
          }}
        >
          <option value="All">All Types</option>
          <option value="Flat">Flat</option>
          <option value="House">House</option>
          <option value="Studio">Studio</option>
        </select>

        <button
          style={{
            padding: '10px 14px',
            backgroundColor: '#4f46e5',
            color: '#fff',
            borderRadius: '6px',
            border: 'none',
            fontWeight: '500',
          }}
          onClick={() => alert('Filters dropdown coming soon')}
        >
          Filters
        </button>

        <button
          style={{
            padding: '10px 14px',
            backgroundColor: '#10b981',
            color: '#fff',
            borderRadius: '6px',
            border: 'none',
            fontWeight: '500',
          }}
          onClick={() => alert('Save Search triggered')}
        >
          Save Search
        </button>

        <button
          style={{
            padding: '10px 14px',
            backgroundColor: showMap ? '#f43f5e' : '#3b82f6',
            color: '#fff',
            borderRadius: '6px',
            border: 'none',
            fontWeight: '500',
          }}
          onClick={() => setShowMap((prev) => !prev)}
        >
          {showMap ? 'Hide Map' : 'Show Map'}
        </button>
      </div>

      {showMap ? (
        <MapView />
      ) : filteredProperties.length > 0 ? (
        filteredProperties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))
      ) : (
        <p>No matching properties found.</p>
      )}
    </div>
  );
}
