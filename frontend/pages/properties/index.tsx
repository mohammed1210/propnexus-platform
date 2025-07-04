import { useEffect, useState } from "react";
import PropertyCard from "../../components/PropertyCard";
import styles from "./Properties.module.css";

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
    fetch("/api/properties")
      .then((res) => res.json())
      .then((data) => setProperties(data))
      .catch((err) => console.error(err));
  }, []);

  const filteredProperties = properties.filter(
    (property) => property.price >= minPrice && property.price <= maxPrice
  );

  return (
    <div>
      <h1>Properties</h1>
      <div className={styles.filters}>
        <label>
          Min Price:
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(Number(e.target.value))}
          />
        </label>
        <label>
          Max Price:
          <input
            type="number"
            value={maxPrice === Infinity ? "" : maxPrice}
            onChange={(e) =>
              setMaxPrice(e.target.value ? Number(e.target.value) : Infinity)
            }
          />
        </label>
      </div>
      <div className={styles.cardsContainer}>
        {filteredProperties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </div>
  );
}
