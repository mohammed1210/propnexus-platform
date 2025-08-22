'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './PropertyCard.module.css';
import supabase from '../lib/supabaseClient';

interface Property {
  id: string | null;
  title: string;
  location: string;
  price: number | null;
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
  const [imgSrc, setImgSrc] = useState(property.imageurl || fallbackImage);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation

    // TODO: replace with real session.user.id when auth is live
    const userId = 'demo-user';

    const { error } = await supabase.from('saved_deals').insert({
      user_id: userId,
      property_id: property.id,
    });

    if (error) {
      console.error('Error saving deal:', error.message);
      alert('❌ Could not save this deal.');
    } else {
      alert('✅ Deal saved!');
    }
  };

  return (
    <Link href={`/property/${property.id ?? ''}`} className={styles.card} prefetch>
      <div className={styles.imageWrapper} style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
        <Image
          src={imgSrc || fallbackImage}
          alt={property.title || 'Property'}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className={styles.image}
          onError={() => setImgSrc(fallbackImage)}
          priority={false}
        />
      </div>

      <div className={styles.info}>
        <h2 className={styles.title}>{property.title}</h2>
        <p className={styles.location}>{property.location}</p>

        <p className={styles.price}>
          £{Number(property.price ?? 0).toLocaleString()}
        </p>

        {(property.bedrooms != null || property.bathrooms != null) && (
          <p className={styles.details}>
            {property.bedrooms != null ? `🛏 ${property.bedrooms}` : ''}{' '}
            {property.bathrooms != null ? `• 🛁 ${property.bathrooms}` : ''}
          </p>
        )}

        <div className={styles.metrics}>
          <span className={styles.badge}>
            📈 Yield: {property.yield_percent ?? 0}% | ROI: {property.roi_percent ?? 0}%
          </span>
        </div>

        <div className={styles.buttons}>
          <button onClick={handleSave} className={styles.save}>
            💾 Save Deal
          </button>
          <button className={styles.detailsBtn}>🔍 View Details</button>
        </div>
      </div>
    </Link>
  );
}