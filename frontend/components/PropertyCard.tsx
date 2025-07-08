import styles from "./PropertyCard.module.css";

interface PropertyProps {
  id: string;
  title: string;
  price: number;
  location: string;
  bedrooms: number;
  bathrooms: number;
  description: string;
  image: string;
}

export default function PropertyCard({
  id,
  title,
  price,
  location,
  bedrooms,
  bathrooms,
  description,
  image,
}: PropertyProps) {
  return (
    <div className={styles.card}>
      <img
        src={image || "/placeholder.jpg"}
        alt={title}
        className={styles.image}
      />
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.location}>{location}</p>
        <p className={styles.price}>£{price.toLocaleString()}</p>
        <p className={styles.details}>
          {bedrooms} beds • {bathrooms} baths
        </p>
        <p className={styles.description}>{description}</p>
        <div className={styles.buttons}>
          <button className={styles.button}>Save Deal</button>
          <button className={styles.buttonSecondary}>View Details</button>
        </div>
      </div>
    </div>
  );
}