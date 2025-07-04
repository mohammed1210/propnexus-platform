import styles from './PropertyCard.module.css';

interface PropertyCardProps {
  title: string;
  price: number;
  location: string;
  imageurl?: string;
}

export default function PropertyCard({ title, price, location, imageurl }: PropertyCardProps) {
  return (
    <div className={styles.card}>
      {imageurl ? (
        <img src={imageurl} alt={title} className={styles.image} />
      ) : (
        <div className={styles.placeholder}>No Image</div>
      )}
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.location}>{location}</p>
        <p className={styles.price}>£{price.toLocaleString()}</p>
      </div>
    </div>
  );
}
