'use client';

import React from 'react';
import styles from './PropertyCard.module.css';
import Link from 'next/link';
import supabase from '../lib/supabaseClient';

interface Property {
  id: string;
  title: string;
  location: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  yield_percent: number;
  roi_percent: number;
  imageurl?: string;
}

interface Props {
  property: Property;
}

export default function PropertyCard({ property }: Props) {
  const fallbackImage = '/placeholder.jpg';

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation

    const userId = 'demo-user'; // Replace with session.user.id when auth is live

    const { error } = await supabase.from('saved_deals').insert({
      user_id: userId,
      property_id: property.id,
    });

    if (error) {
      console.error('Error saving deal:', error.message);
    } else {
      alert('✅ Deal saved!');
    }
  };

  return (
    <Link href={`/property/${property.id}`} className={styles.card}>
      <div className={styles.imageWrapper}>
        <img
          src={property.imageurl || fallbackImage}
          alt={property.title}
          className={styles.image}
          onError={(e) => {
            (e.target as HTMLImageElement).src = fallbackImage;
          }}
        />
      </div>

      <div className={styles.info}>
        <h2 className={styles.title}>{property.title}</h2>
        <p className={styles.location}>{property.location}</p>
        <p className={styles.price}>
          £{property.price?.toLocaleString() || 'N/A'}
        </p>

        {(property.bedrooms || property.bathrooms) && (
          <p className={styles.details}>
            {property.bedrooms ? `🛏 ${property.bedrooms}` : ''}{" "}
            {property.bathrooms ? `• 🛁 ${property.bathrooms}` : ''}
          </p>
        )}

        <div className={styles.metrics}>
          <span className={styles.badge}>
            📈 Yield: {property.yield_percent || 0}% | ROI: {property.roi_percent || 0}%
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
