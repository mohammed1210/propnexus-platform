import { useEffect, useState } from 'react';
import PropertyCard from "../../components/PropertyCard";
import styles from './PropertiesPage.module.css';

interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  imageurl: string;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [locationFilter, setLocationFilter] = useState('');

  useEffect(() => {
    fetch('/api/properties')
      .then(res => res.json())
      .then(data => setProperties(data))
      .catch(err => console.error(err));
  }, []);

  const filteredProperties = properties.filter((p) => {
    const matchesMin = minPrice === '' || p.price >= minPrice;
    const matchesMax = maxPrice === '' || p.price <= maxPrice;
    const matchesLocation = locationFilter === '' || p.location.toLowerCase().includes(locationFilter.toLowerCase());
    return matchesMin && matchesMax && matchesLocation;
  });

  return (
    <div>
      <h1>Properties</h1>

      <div className={styles.filters}>
        <input
          type="number"
          placeholder="Min price"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value ? parseInt(e.target.value) : '')}
        />
        <input
          type="number"
          placeholder="Max price"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value ? parseInt(e.target.value) : '')}
        />
        <input
          type="text"
          placeholder="Location"
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
        />
      </div>

      <div className={styles.cardsContainer}>
        {filteredProperties.map((p) => (
          <PropertyCard
            key={p.id}
            title={p.title}
            price={p.price}
            location={p.location}
            imageurl={p.imageurl}
          />
        ))}
      </div>
    </div>
  );
}
