import styles from "./PropertyCard.module.css";

export interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  bedrooms: number;
  bathrooms: number;
  description: string;
  image: string;
}

interface PropertyCardProps {
  property: Property;
}

<img
  src={image ? image : "/placeholder.jpg"}
  alt={title}
  className={styles.image}
/>

export default function PropertyCard({ property }: PropertyCardProps) {
  return (
    <div className={styles.card}>
      <img
        src={property.image || "/placeholder.jpg"}
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
      </div>
    </div>
  );
}
