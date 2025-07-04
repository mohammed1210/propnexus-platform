import { useEffect, useState } from 'react';
import PropertyCard from "@/components/PropertyCard";
import styles from "@/styles/Properties.module.css";

interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  imageurl: string;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(Infinity);

  useEffect(() => {
    fetch('/api/properties') // <-- update to your backend endpoint if needed
      .then(res => res.json())
      .then(data => setProperties(data))
      .catch(err => console.error(err));
  }, []);

  const filteredProperties = properties.filter(
    (property) => property.price >= minPrice && property.price <= maxPrice
  );

  return (
    <div>
      <h1>Properties</h1>
      <div className={styles.filters}>
        <input
          type="number"
          placeholder="Min price"
          onChange={(e) => setMinPrice(Number(e.target.value))}
        />
        <input
          type="number"
          placeholder="Max price"
          onChange={(e) => setMaxPrice(Number(e.target.value))}
        />
      </div>
      <div className={styles.cardsContainer}>
        {filteredProperties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </div>
  );
}
