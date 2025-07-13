import styles from "./PropertyCard.module.css";
import type { Property } from "../src/app/types";

interface PropertyCardProps {
  property: Property;
}

export default function PropertyCard({ property }: PropertyCardProps) {
  return (
    <div className={styles.card}>
      <img
        src={property.imageurl || "/placeholder.jpg"}
        alt={property.title}
        className={styles.image}
      />
      <div className={styles.content}>
        <h3>{property.title}</h3>
        <p>{property.location}</p>
        <p>£{property.price.toLocaleString()}</p>
        <p>
          {property.bedrooms} beds • {property.bathrooms} baths
        </p>
        <p>{property.description}</p>
        <p>Yield: {property.yield_percent}% | ROI: {property.roi_percent}%</p>
        <div className={styles.buttons}>
          <button
            className={styles.button}
            onClick={() => alert("Deal saved!")}
          >
            Save Deal
          </button>
          <button className={styles.buttonSecondary}>View Details</button>
        </div>
      </div>
    </div>
  );
}
