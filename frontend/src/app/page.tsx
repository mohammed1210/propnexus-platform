'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [properties, setProperties] = useState([]);

  useEffect(() => {
    fetch('https://propnexus-backend-production.up.railway.app/properties')
      .then(res => res.json())
      .then(data => setProperties(data))
      .catch(() => setProperties([]));
  }, []);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Live Property Deals</h1>
      {properties.length === 0 ? (
        <p>No properties found.</p>
      ) : (
        properties.map((property: any, idx) => (
          <div key={idx} style={{ marginBottom: '1rem', borderBottom: '1px solid #333', paddingBottom: '1rem' }}>
            <strong>{property.title}</strong><br />
            Price: £{property.price}<br />
            <p>Yield: {property.yield_percent ? `${property.yield_percent}%` : 'N/A'}</p>
          </div>
        ))
      )}
    </main>
  );
}
