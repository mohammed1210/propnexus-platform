import { useEffect, useState } from 'react';
import PropertyCard from "../../components/PropertyCard";
import styles from "@/styles/properties.module.css";

interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  bedrooms: number;
  bathrooms: number;
  description: string;
  image: string;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(1000000);
  const [minBedrooms, setMinBedrooms] = useState<number>(0);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch("https://propnexus-backend-production.up.railway.app/properties");
        const data = await res.json();
        setProperties(data);
      } catch (error) {
        console.error("Failed to fetch properties:", error);
      }
    };
    fetchProperties();
  }, []);

  const filteredProperties = properties.filter(
    (p) =>
      p.price >= minPrice &&
      p.price <= maxPrice &&
      p.bedrooms >= minBedrooms
  );

  return (
    <main className={styles.main}>
      <h1>Available Properties</h1>

      <div className={styles.filters}>
        <label>
          Min Price:
          <input type="number" value={minPrice} onChange={(e) => setMinPrice(Number(e.target.value))} />
        </label>
        <label>
          Max Price:
          <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} />
        </label>
        <label>
          Min Bedrooms:
          <input type="number" value={minBedrooms} onChange={(e) => setMinBedrooms(Number(e.target.value))} />
        </label>
      </div>

      <div className={styles.cardsContainer}>
        {filteredProperties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </main>
  );
}
