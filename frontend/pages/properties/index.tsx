import { useEffect, useState } from 'react';
import PropertyCard from "@/components/PropertyCard";

interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  imageurl?: string;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [maxPrice, setMaxPrice] = useState<number>(1000000);
  const [minPrice, setMinPrice] = useState<number>(0);

  useEffect(() => {
    fetch('/api/properties')
      .then(res => res.json())
      .then(data => setProperties(data))
      .catch(err => console.error(err));
  }, []);

  const filteredProperties = properties.filter(
    (p) => p.price >= minPrice && p.price <= maxPrice
  );

  return (
    <div>
      <h1>Available Properties</h1>

      <div style={{ marginBottom: '20px' }}>
        <label>Min Price: £{minPrice}</label>
        <input
          type="range"
          min="0"
          max="2000000"
          step="50000"
          value={minPrice}
          onChange={(e) => setMinPrice(Number(e.target.value))}
        />

        <label>Max Price: £{maxPrice}</label>
        <input
          type="range"
          min="50000"
          max="5000000"
          step="50000"
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        {filteredProperties.map((prop) => (
          <PropertyCard
            key={prop.id}
            title={prop.title}
            price={prop.price}
            location={prop.location}
            imageurl={prop.imageurl}
          />
        ))}
      </div>
    </div>
  );
}