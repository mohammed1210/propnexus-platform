'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [properties, setProperties] = useState<any[]>([]);

  useEffect(() => {
    fetch('https://propnexus-backend-production.up.railway.app/properties')
      .then((res) => res.json())
      .then((data) => setProperties(data))
      .catch(() => setProperties([]));
  }, []);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Live Property Deals</h1>
      {properties.length === 0 ? (
        <p>No properties found.</p>
      ) : (
        properties.map((property, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: '1rem',
              padding: '1rem',
              border: '1px solid #ccc',
              borderRadius: '6px',
              background: '#f9f9f9',
            }}
          >
            <strong>{property.title}</strong>
            <p>Price: {property.price}</p>
            <p>Yield: {property.yield_percent ? `${property.yield_percent}%` : 'N/A'}</p>
            <p>ROI: {property.roi_percent ? `${property.roi_percent}%` : 'N/A'}</p>
            <p>BMV: {property.bmv ? `${property.bmv}%` : 'N/A'}</p>
            <p>Location: {property.location}</p>
            <p>Source: {property.source}</p>
            <img src={property.imageurl} alt={property.title} style={{ maxWidth: '100%', marginTop: '0.5rem' }} />
            <p>{property.description}</p>
          </div>
        ))
      )}
    </main>
  );
}
