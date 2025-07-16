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
  image: string;
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
    <div style={{ padding: '20px', backgroundColor: '#f9fafb' }}>
      <h1 style={{ marginBottom: '20px' }}>Property Listings</h1>

      <div
        style={{
          backgroundColor: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '10px',
          padding: '15px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <input
          type="text"
          placeholder="Search by location"
          value={searchLocation}
          onChange={(e) => setSearchLocation(e.target.value)}
          style={{
            padding: '8px',
            borderRadius: '5px',
            border: '1px solid #d1d5db',
          }}
        />

        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="number"
            placeholder="Min Price"
            value={minPrice}
            onChange={(e) => setMinPrice(Number(e.target.value))}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '5px',
              border: '1px solid #d1d5db',
            }}
          />
          <input
            type="number"
            placeholder="Max Price"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '5px',
              border: '1px solid #d1d5db',
            }}
          />
        </div>
      </div>

      {filteredProperties.length > 0 ? (
        filteredProperties.map((property) => (
          <PropertyCard key={property.id} {...property} />
        ))
      ) : (
        <p>No matching properties found.</p>
      )}
    </div>
  );
}