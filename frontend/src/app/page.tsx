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
  const [showMap, setShowMap] = useState<boolean>(true);

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
    <div className="main-wrapper">
      <div className="header-bar">
        <h1>Find Your Next Investment Property</h1>
        <button
          className="mode-toggle"
          onClick={() =>
            document.documentElement.classList.toggle('dark-mode')
          }
        >
          🌓
        </button>
      </div>

      <div className="filters-row">
        <input
          type="text"
          placeholder="Search location"
          value={searchLocation}
          onChange={(e) => setSearchLocation(e.target.value)}
        />
        <input
          type="number"
          placeholder="Min Price"
          value={minPrice}
          onChange={(e) => setMinPrice(Number(e.target.value))}
        />
        <input
          type="number"
          placeholder="Max Price"
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
        />
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
        <select
          value={propertyType}
          onChange={(e) => setPropertyType(e.target.value)}
        >
          <option value="All">All Types</option>
          <option value="Flat">Flat</option>
          <option value="House">House</option>
          <option value="Studio">Studio</option>
        </select>
        <button onClick={() => alert('Filters coming soon')}>Filters</button>
        <button onClick={() => alert('Save Search')}>Save Search</button>
        <button onClick={() => setShowMap((prev) => !prev)}>
          {showMap ? 'Hide Map' : 'Show Map'}
        </button>
      </div>

      <div className="content-layout">
        <div className="property-list">
          {filteredProperties.length > 0 ? (
            filteredProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))
          ) : (
            <p>No matching properties found.</p>
          )}
        </div>
        {showMap && <MapView />}
      </div>
    </div>
  );
}