'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [properties, setProperties] = useState<any[]>([]);

  useEffect(() => {
    fetch('https://propnexus-backend-production.up.railway.app/properties')
      .then((res) => res.json())
      .then((data) => {
        console.log('Fetched properties:', data); // Debug log
        setProperties(data);
      })
      .catch(() => setProperties([]));
  }, []);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Live Property Deals</h1>
      {properties.length === 0 ? (
        <p>No properties found.</p>
      ) : (
        properties.map((property, idx) => (
          <div key={idx} style={{ marginBottom: '1rem', borderBottom: '1px solid #333', paddingBottom: '1rem' }}>
            <strong>{property.title}</strong><br />
            Price: £{property.price}<br />
            Location: {property.location}<br />
            Yield: {property.yield_percent ? `${property.yield_percent}%` : 'N/A'}<br />
            ROI: {property.roi_percent ? `${property.roi_percent}%` : 'N/A'}<br />
            Source: {property.source}
          </div>
        ))
      )}
    </main>
  );
}
