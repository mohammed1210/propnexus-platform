'use client';

import { useEffect, useState } from 'react';
import PropertyCard from '../../components/PropertyCard';
import type { Property } from './types';

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch("https://propnexus-backend-production.up.railway.app/properties");
        const data: Property[] = await res.json();
        console.log("Fetched properties:", data); // ✅ Add console log to debug
        setProperties(data);
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };

    fetchProperties();
  }, []);

  return (
    <div>
      <h1>Properties</h1>
      {properties.length === 0 ? (
        <p>No properties found.</p>
      ) : (
        properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))
      )}
    </div>
  );
}
