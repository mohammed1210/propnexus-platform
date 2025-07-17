'use client';

import { useEffect, useState } from 'react';
import PropertyCard from '../../components/PropertyCard';
import styles from './Properties.module.css';

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
      return matchesPrice && matchesLocation;
    });
    setFilteredProperties(filtered);
  }, [minPrice, maxPrice, searchLocation, properties]);

  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: '#f9fafb',
        minHeight: '100vh',
        maxWidth: '1000px',
        margin: '0 auto',
      }}
    >
      <h1
        style={{
          marginBottom: '20px',
          backgroundColor: '#e2e8f0', // darker slate gray
          padding: '16px 24px',
          borderRadius: '8px',
          fontSize: '24px',
          fontWeight: '600',
          color: '#111827',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        Find Your Next Investment Property
      </h1>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '10px',
          padding: '20px',
          marginBottom: '30px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
        }}
      >
        <input
          type="text"
          placeholder="Search by location"
          value={searchLocation}
          onChange={(e) => setSearchLocation(e.target.value)}
          style={{
            flex: '1 1 180px',
            padding: '10px',
            fontSize: '16px',
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
            fontSize: '16px',
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
            fontSize: '16px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
          }}
        />
      </div>

      {filteredProperties.length > 0 ? (
        filteredProperties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))
      ) : (
        <p>No matching properties found.</p>
      )}
    </div>
  );
}
