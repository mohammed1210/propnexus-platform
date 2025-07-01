'use client';

import { useEffect, useState } from 'react';
import GoogleMapReact from 'google-map-react';

export default function Home() {
  const [properties, setProperties] = useState<any[]>([]);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000000);
  const [minYield, setMinYield] = useState(0);
  const [source, setSource] = useState('All');

  useEffect(() => {
    fetch('https://propnexus-backend-production.up.railway.app/properties')
      .then(res => res.json())
      .then(data => {
        console.log('Fetched properties:', data);
        setProperties(data);
      })
      .catch(() => setProperties([]));
  }, []);

  const filtered = properties.filter(p => {
    const priceOK = p.price >= minPrice && p.price <= maxPrice;
    const yieldOK = p.yield_percent >= minYield;
    const sourceOK = source === 'All' || p.source === source;
    return priceOK && yieldOK && sourceOK;
  });

  // Approx coordinates if missing
  const getCoords = (location: string) => {
    if (location.includes('London')) return { lat: 51.5072, lng: -0.1276 };
    if (location.includes('Manchester')) return { lat: 53.4808, lng: -2.2426 };
    if (location.includes('Leeds')) return { lat: 53.8008, lng: -1.5491 };
    if (location.includes('Surrey')) return { lat: 51.2798, lng: -0.5427 };
    if (location.includes('Liverpool')) return { lat: 53.4084, lng: -2.9916 };
    return { lat: 52.3555, lng: -1.1743 }; // Default UK
  };

  const Marker = ({ text }: { text: string }) => (
    <div style={{ color: 'red', fontWeight: 'bold' }}>{text}</div>
  );

  return (
    <main style={{ padding: '1rem' }}>
      <h1>Properties</h1>
      <div>
        <label>Min Price (£): </label>
        <input type="number" value={minPrice} onChange={e => setMinPrice(Number(e.target.value))} />
        <label>Max Price (£): </label>
        <input type="number" value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))} />
        <label>Min Yield (%): </label>
        <input type="number" value={minYield} onChange={e => setMinYield(Number(e.target.value))} />
        <label>Source: </label>
        <select value={source} onChange={e => setSource(e.target.value)}>
          <option value="All">All</option>
          <option value="Rightmove">Rightmove</option>
          <option value="Zoopla">Zoopla</option>
        </select>
      </div>

      <div style={{ height: '500px', width: '100%', marginTop: '1rem' }}>
        <GoogleMapReact
          bootstrapURLKeys={{ key: 'AIzaSyCkjrvxTk_GSFhDMyuOgpgxBnH9gF-oGSM' }}
          defaultCenter={{ lat: 54.5, lng: -3 }}
          defaultZoom={6}
        >
          {filtered.map((p, idx) => {
            const coords = getCoords(p.location);
            return (
              <Marker
                key={idx}
                lat={coords.lat}
                lng={coords.lng}
                text={`£${p.price}`}
              />
            );
          })}
        </GoogleMapReact>
      </div>

      {filtered.length === 0 ? (
        <p>No properties found.</p>
      ) : (
        filtered.map((p, idx) => (
          <div key={idx} style={{ margin: '1rem 0', padding: '1rem', border: '1px solid #333', borderRadius: '6px' }}>
            <strong>{p.title}</strong><br />
            Price: £{p.price}<br />
            Location: {p.location}<br />
            Yield: {p.yield_percent}%<br />
            ROI: {p.roi_percent}%<br />
            Source: {p.source}<br />
          </div>
        ))
      )}
    </main>
  );
}
