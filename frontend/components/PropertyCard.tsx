'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import supabase from '../lib/supabaseClient';
import styles from './PropertyCard.module.css';

interface Property {
  id: string;
  title: string;
  location: string;
  price: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  imageurl?: string | null;
}

interface Props {
  property: Property;
}

export default function PropertyCard({ property }: Props) {
  const fallbackImage = '/placeholder.jpg';

  const handleSave = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); // prevent Link navigation on click

    const userId = 'demo-user'; // TODO: replace with session.user.id once auth is live
    const { error } = await supabase.from('saved_deals').insert({
      user_id: userId,
      property_id: property.id,
    });

    if (error) {
      console.error('Error saving deal:', error.message);
      alert('❌ Could not save — try again.');
    } else {
      alert('✅ Deal saved!');
    }
  };

  const priceLabel =
    typeof property.price === 'number'
      ? `£${property.price.toLocaleString()}`
      : '£—';

  const bedsBaths =
    (property.bedrooms ?? null) || (property.bathrooms ?? null)
      ? `${property.bedrooms ? `🛏 ${property.bedrooms}` : ''}${
          property.bedrooms && property.bathrooms ? ' • ' : ''
        }${property.bathrooms ? `🛁 ${property.bathrooms}` : ''}`
      : '';

  const yieldRoi = `📈 Yield: ${property.yield_percent ?? 0}% | ROI: ${
    property.roi_percent ?? 0
  }%`;

  return (
    <Link href={`/property/${property.id}`} className={styles.card} prefetch>
      <div className={styles.imageWrapper}>
        <Image
          src={property.imageurl || fallbackImage}
          alt={property.title || 'Property'}
          width={640}
          height={400}
          className={styles.image}
          // graceful fallback if remote image 404s
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = fallbackImage;
          }}
          sizes="(max-width: 768px) 100vw, 50vw"
          priority={false}
        />
      </div>

      <div className={styles.info}>
        <h2 className={styles.title}>{property.title}</h2>
        <p className={styles.location}>{property.location}</p>
        <p className={styles.price}>{priceLabel}</p>

        {!!bedsBaths && <p className={styles.details}>{bedsBaths}</p>}

        <div className={styles.metrics}>
          <span className={styles.badge}>{yieldRoi}</span>
        </div>

        <div className={styles.buttons}>
          <button type="button" onClick={handleSave} className={styles.save}>
            💾 Save Deal
          </button>
          <button type="button" className={styles.detailsBtn}>
            🔍 View Details
          </button>
        </div>
      </div>
    </Link>
  );
}