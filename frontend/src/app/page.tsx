
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
  const [searchLocation, setSearchLocation] = useState<string>('');
  const [investmentType, setInvestmentType] = useState<string>('All');
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(2000000);
  const [bedrooms, setBedrooms] = useState<string>('Any');
  const [bathrooms, setBathrooms] = useState<string>('Any');
  const [propertyType, setPropertyType] = useState<string>('All');
  const [roi, setRoi] = useState<number>(0);
  const [showFilters, setShowFilters] = useState<boolean>(false);
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
      const matchesBathrooms =
        bathrooms === 'Any' || property.bathrooms === Number(bathrooms);
      const matchesPropertyType =
        propertyType === 'All' || property.propertyType.toLowerCase() === propertyType.toLowerCase();
      const matchesInvestmentType =
        investmentType === 'All' || property.investmentType?.toLowerCase() === investmentType.toLowerCase();
      const matchesROI = property.roi_percent >= roi;

      return (
        matchesPrice &&
        matchesLocation &&
        matchesBedrooms &&
        matchesBathrooms &&
        matchesPropertyType &&
        matchesInvestmentType &&
        matchesROI
      );
    });

    setFilteredProperties(filtered);
  }, [
    searchLocation,
    investmentType,
    minPrice,
    maxPrice,
    bedrooms,
    bathrooms,
    propertyType,
    roi,
    properties,
  ]);

  return (
    <div style={{ padding: '20px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <h1 style={{
        marginBottom: '20px',
        backgroundColor: '#e2e8f0',
        padding: '16px 20px',
        borderRadius: '10px',
        fontSize: '24px',
        fontWeight: '600',
        color: '#1e293b'
      }}>
        Prop-Nexus
      </h1>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <input type="text" placeholder="Search by location" value={searchLocation} onChange={(e) => setSearchLocation(e.target.value)} style={{ flex: '2', padding: '10px' }} />
        <select value={investmentType} onChange={(e) => setInvestmentType(e.target.value)} style={{ flex: '1' }}>
          <option value="All">All Types</option>
          <option value="HMO">HMO</option>
          <option value="Flip">Flip</option>
        </select>
        <button onClick={() => setShowFilters(!showFilters)} style={{ flex: '1', backgroundColor: '#4f46e5', color: '#fff' }}>Filters</button>
        <button style={{ flex: '1', backgroundColor: '#10b981', color: '#fff' }}>Save Search</button>
        <button onClick={() => setShowMap((prev) => !prev)} style={{ flex: '1', backgroundColor: showMap ? '#f43f5e' : '#3b82f6', color: '#fff' }}>
          {showMap ? 'Hide Map' : 'Show Map'}
        </button>
      </div>

      {showFilters && (
        <div className="filter-dropdown">
          <input type="number" placeholder="Min Price" value={minPrice} onChange={(e) => setMinPrice(Number(e.target.value))} />
          <input type="number" placeholder="Max Price" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} />
          <select value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}>
            <option value="Any">Any Beds</option>
            <option value="1">1 Bed</option>
            <option value="2">2 Beds</option>
            <option value="3">3 Beds</option>
          </select>
          <select value={bathrooms} onChange={(e) => setBathrooms(e.target.value)}>
            <option value="Any">Any Baths</option>
            <option value="1">1 Bath</option>
            <option value="2">2 Baths</option>
          </select>
          <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
            <option value="All">All Types</option>
            <option value="Flat">Flat</option>
            <option value="House">House</option>
          </select>
          <input type="number" placeholder="Min ROI" value={roi} onChange={(e) => setRoi(Number(e.target.value))} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: showMap ? 'row' : 'column' }}>
        <div style={{ flex: '1' }}>
          {filteredProperties.length > 0 ? (
            filteredProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))
          ) : (
            <p>No matching properties found.</p>
          )}
        </div>
        {showMap && <div style={{ flex: '1' }}><MapView /></div>}
      </div>
    </div>
  );
}
