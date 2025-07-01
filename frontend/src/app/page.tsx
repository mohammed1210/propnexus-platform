'use client';

import { useEffect, useState } from 'react';

type Property = {
  id: string;
  title: string;
  price: number;
  location: string;
  yield_percent: number;
  roi_percent: number;
  source: string;
};

export default function Home() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000000);
  const [minYield, setMinYield] = useState(0);
  const [source, setSource] = useState("All");

  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number }[]>([]);

  useEffect(() => {
    fetch('https://propnexus-backend-production.up.railway.app/properties')
      .then(res => res.json())
      .then(data => {
        console.log("Fetched properties:", data);
        setProperties(data);
        fetchCoordinates(data);
      })
      .catch(() => setProperties([]));
  }, []);

  const fetchCoordinates = async (props: Property[]) => {
    const coords = await Promise.all(props.map(async (prop) => {
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(prop.location)}&key=AIzaSyCkjrvxTk_GSFhDMyuOgpgxBnH9gF-oGSM`
        );
        const data = await response.json();
        if (data.status === "OK" && data.results[0]) {
          return data.results[0].geometry.location;
        }
      } catch (err) {
        console.error("Geocoding error:", err);
      }
      return { lat: 0, lng: 0 };
    }));
    setCoordinates(coords);
  };

  const filteredProperties = properties.filter((prop) => {
    return (
      prop.price >= minPrice &&
      prop.price <= maxPrice &&
      prop.yield_percent >= minYield &&
      (source === "All" || prop.source === source)
    );
  });

  return (
    <main style={{ padding: '1rem' }}>
      <h1>Properties</h1>
      <div style={{ marginBottom: '1rem' }}>
        <label>
          Min Price (£): <input type="number" value={minPrice} onChange={e => setMinPrice(Number(e.target.value))} />
        </label>
        <label style={{ marginLeft: '1rem' }}>
          Max Price (£): <input type="number" value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))} />
        </label>
        <label style={{ marginLeft: '1rem' }}>
          Min Yield (%): <input type="number" value={minYield} onChange={e => setMinYield(Number(e.target.value))} />
        </label>
        <label style={{ marginLeft: '1rem' }}>
          Source: 
          <select value={source} onChange={e => setSource(e.target.value)}>
            <option value="All">All</option>
            <option value="Rightmove">Rightmove</option>
            <option value="Zoopla">Zoopla</option>
          </select>
        </label>
      </div>

      <div style={{ height: '400px', width: '100%', marginBottom: '1rem' }}>
        <iframe
          width="100%"
          height="100%"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://www.google.com/maps/embed/v1/view?key=AIzaSyCkjrvxTk_GSFhDMyuOgpgxBnH9gF-oGSM&center=51.5074,-0.1278&zoom=6`}
        ></iframe>
      </div>

      {filteredProperties.length === 0 ? (
        <p>No properties found.</p>
      ) : (
        filteredProperties.map((prop) => (
          <div key={prop.id} style={{ marginBottom: '1rem', border: '1px solid #333', padding: '1rem' }}>
            <strong>{prop.title}</strong><br />
            Price: £{prop.price}<br />
            Location: {prop.location}<br />
            Yield: {prop.yield_percent}%<br />
            ROI: {prop.roi_percent}%<br />
            Source: {prop.source}
          </div>
        ))
      )}
    </main>
  );
}
