import Link from 'next/link';
import styles from './PropertyCard.module.css';
import FallbackImage from './FallbackImage';
import { fmtGBP, fmtPct, plural } from '../lib/format';

export type Property = {
  id: string;
  title: string;
  location?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  imageurl?: string | null;
};

export default function PropertyCard({ p }: { p: Property }) {
  if (!p) return null;

  return (
    <article className={styles.card}>
      {/* Image block with zoom-on-hover */}
      <Link href={`/property/${p.id}`} aria-label={`Open ${p.title}`}>
        <div className={styles.imageWrapper}>
          <FallbackImage
            src={p.imageurl || null}
            alt={p.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            style={{ objectFit: 'cover' }}
            className={styles.image}
          />
        </div>
      </Link>

      {/* Info block (always visible, not zoomed) */}
      <div className={styles.info}>
        <Link href={`/property/${p.id}`} className={styles.title}>
          {p.title}
        </Link>
        {p.location && <div className={styles.location}>{p.location}</div>}

        <div className={styles.details}>
          <span>{plural(p.bedrooms ?? 0, 'bed')}</span>
          <span>•</span>
          <span>{plural(p.bathrooms ?? 0, 'bath')}</span>
        </div>

        <div className={styles.price}>{fmtGBP(p.price ?? 0)}</div>

        <div className={styles.metrics}>
          <span className={styles.badge}>Yield {fmtPct(p.yield_percent)}</span>
          <span className={styles.badge}>ROI {fmtPct(p.roi_percent)}</span>
        </div>

        {/* Buttons fixed in their own row */}
        <div className={styles.buttons}>
          <button className={styles.save} type="button">
            Save Deal
          </button>
          <Link className={styles.detailsBtn} href={`/property/${p.id}`}>
            View Details
          </Link>
        </div>
      </div>
    </article>
  );
}
