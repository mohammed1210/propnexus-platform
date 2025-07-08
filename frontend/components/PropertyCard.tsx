import styles from "./PropertyCard.module.css";
import { Property } from "../src/app/types";

export default function PropertyCard({ property }: { property: Property }) {
  return (
    <div className={styles.card}>
      <img src={property.image || "/placeholder.jpg"} alt={property.title} className={styles.image} />
      <div className={styles.content}>
        <h3>{property.title}</h3>
        <p>{property.location}</p>
        <p>£{property.price.toLocaleString()}</p>
        <p>{property.bedrooms} beds • {property.bathrooms} baths</p>
        <p>{property.description}</p>
      </div>
    </div>
  );
}