// components/PropertyCard.tsx
'use client';

import React from 'react';
import styles from './PropertyCard.module.css';
import Link from 'next/link';
import supabase from '@lib/supabaseClient'; // ✅ CORRECT
import supabase from '@lib/supabaseClient';

interface Property {
  id: string;
@@ -26,10 +25,9 @@
  const fallbackImage = '/placeholder.jpg';

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent Link navigation
    e.preventDefault(); // Prevent navigation

    // 🚧 TEMPORARY: No auth, so we use placeholder user ID
    const userId = 'demo-user'; // Replace with real session.user.id later
    const userId = 'demo-user'; // 🔐 Replace with session.user.id when ready

    const { error } = await supabase.from('saved_deals').insert({
      user_id: userId,
@@ -39,43 +37,46 @@
    if (error) {
      console.error('Error saving deal:', error.message);
    } else {
      alert('Deal saved!');
      alert('✅ Deal saved!');
    }
  };

  return (
    <Link href={`/property/${property.id}`} className={styles.card}>
      <img
        src={property.imageurl || fallbackImage}
        alt={property.title}
        className={styles.image}
        onError={(e) => {
          (e.target as HTMLImageElement).src = fallbackImage;
        }}
      />
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
        <div className={styles.title}>{property.title}</div>
        <div className={styles.location}>{property.location}</div>
        <div className={styles.price}>
          £{property.price?.toLocaleString?.() || 'N/A'}
        </div>
        <h2 className={styles.title}>{property.title}</h2>
        <p className={styles.location}>{property.location}</p>

        <div className={styles.details}>
          🛏 {property.bedrooms} beds • 🛁 {property.bathrooms} bath
        </div>
        <p className={styles.price}>
          £{property.price?.toLocaleString() || 'N/A'}
        </p>

        <div className={styles.metrics}>
        <p className={styles.details}>
          🛏 {property.bedrooms} • 🛁 {property.bathrooms}
        </p>

        <p className={styles.metrics}>
          📈 Yield: {property.yield_percent || 0}% | ROI: {property.roi_percent || 0}%
        </div>
        </p>

        <div className={styles.buttons}>
          <button className={styles.save} onClick={handleSave}>
          <button onClick={handleSave} className={styles.save}>
            💾 Save Deal
          </button>
          <button className={styles.detailsBtn}>🔍 View Details</button>
        </div>
      </div>
    </Link>
  );
}
