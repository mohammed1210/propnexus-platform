'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const Map = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

export default function Home() {
  const [properties, setProperties] = useState<any[]>([]);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(9999999);
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

  const filteredProperties = properties.filter((p) => {
    return (
      p.price >= minPrice &&
      p.price <= maxPrice &&
      (p.yield_percent ?? 0) >= minYield &&
      (source === 'All' || p.source === source)
    );
  });

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Properties with Map</h1>
      <div style={{ marginBottom: '1rem' }}>
        <label>Min Price (£): </label>
        <input type="number" value={minPrice} onChange={(e) => setMinPrice(Number(e.target.value))} />
        <label style={{ marginLeft: '1rem' }}>Max Price (£): </label>
        <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} />
        <label style={{ marginLeft: '1rem' }}>Min Yield (%): </label>
        <input type="number" value={minYield} onChange={(e) => setMinYield(Number(e.target.value))} />
        <label style={{ marginLeft: '1rem' }}>Source: </label>
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="All">All</option>
          <option value="Rightmove">Rightmove</option>
          <option value="Zoopla">Zoopla</option>
        </select>
      </div>

      <div style={{ height: '500px', marginBottom: '1rem' }}>
        <Map center={[53.5, -1]} zoom={5} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {filteredProperties.map((property, idx) => (
            <Marker
              key={idx}
              position={
                // Approximate random positions for now
                property.location?.includes('London')
                  ? [51.5074, -0.1278]
                  : property.location?.includes('Manchester')
                  ? [53.4808, -2.2426]
                  : property.location?.includes('Leeds')
                  ? [53.8008, -1.5491]
                  : property.location?.includes('Birmingham')
                  ? [52.4862, -1.8904]
                  : [53.5, -1]
              }
            >
              <Popup>
                <strong>{property.title}</strong><br />
                £{property.price}<br />
                Yield: {property.yield_percent ?? 'N/A'}%<br />
                Source: {property.source}
              </Popup>
            </Marker>
          ))}
        </Map>
      </div>

      {filteredProperties.map((property, idx) => (
        <div key={idx} style={{ marginBottom: '1rem', border: '1px solid #333', padding: '1rem' }}>
          <strong>{property.title}</strong><br />
          Price: £{property.price}<br />
          Yield: {property.yield_percent ?? 'N/A'}%<br />
          Source: {property.source}
        </div>
      ))}
    </main>
  );
}
