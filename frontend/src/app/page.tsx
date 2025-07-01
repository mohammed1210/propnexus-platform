import React, { useState, useEffect } from 'react';

export default function PropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);

  // Filters
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000000);
  const [minYield, setMinYield] = useState(0);
  const [selectedSource, setSelectedSource] = useState('all');

  // Fetch properties on load
  useEffect(() => {
    fetch('https://propnexus-backend-production.up.railway.app/properties')
      .then((res) => res.json())
      .then((data) => {
        setProperties(data);
        setFilteredProperties(data);
      })
      .catch((err) => console.error('Error fetching properties:', err));
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = properties;

    filtered = filtered.filter((prop) => prop.price >= minPrice && prop.price <= maxPrice);
    filtered = filtered.filter((prop) => prop.yield_percent >= minYield);

    if (selectedSource !== 'all') {
      filtered = filtered.filter((prop) => prop.source.toLowerCase() === selectedSource);
    }

    setFilteredProperties(filtered);
  }, [minPrice, maxPrice, minYield, selectedSource, properties]);

  return (
    <div>
      <h1>Properties</h1>

      {/* Filters Panel */}
      <div style={{ marginBottom: '1rem', border: '1px solid #ccc', padding: '1rem' }}>
        <div>
          <label>Min Price (£): </label>
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(Number(e.target.value))}
          />
        </div>
        <div>
          <label>Max Price (£): </label>
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
          />
        </div>
        <div>
          <label>Min Yield (%): </label>
          <input
            type="number"
            value={minYield}
            onChange={(e) => setMinYield(Number(e.target.value))}
          />
        </div>
        <div>
          <label>Source: </label>
          <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)}>
            <option value="all">All</option>
            <option value="zoopla">Zoopla</option>
            <option value="rightmove">Rightmove</option>
          </select>
        </div>
      </div>

      {/* Properties Grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {filteredProperties.map((prop) => (
          <div
            key={prop.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '1rem',
              margin: '0.5rem',
              width: '250px',
            }}
          >
            <img
              src={prop.imageurl}
              alt={prop.title}
              style={{ width: '100%', height: '150px', objectFit: 'cover' }}
            />
            <h3>{prop.title}</h3>
            <p>£{prop.price}</p>
            <p>Yield: {prop.yield_percent}%</p>
            <p>Source: {prop.source}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
