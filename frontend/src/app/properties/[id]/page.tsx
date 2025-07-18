'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Property } from '../../../types';

export default function PropertyDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/properties/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setProperty(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (!id) return <p>Invalid property ID.</p>;
  if (loading) return <p>Loading...</p>;
  if (!property) return <p>Property not found.</p>;

  return (
    <div
      style={{
        maxWidth: '960px',
        margin: '40px auto',
        padding: '24px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
      }}
    >
      <button
        onClick={() => router.back()}
        style={{
          marginBottom: '20px',
          backgroundColor: '#e2e8f0',
          border: 'none',
          padding: '10px 16px',
          borderRadius: '8px',
          cursor: 'pointer',
          color: '#1e293b',
          fontWeight: '500',
        }}
      >
        ← Back to Listings
      </button>

      <img
        src={property.imageurl || '/placeholder.jpg'}
        alt={property.title}
        style={{
          width: '100%',
          height: 'auto',
          borderRadius: '10px',
          marginBottom: '24px',
          backgroundColor: '#f1f5f9',
        }}
      />

      <h1 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '8px' }}>
        {property.title}
      </h1>
      <p style={{ fontSize: '17px', color: '#64748b' }}>{property.location}</p>
      <p
        style={{
          fontSize: '22px',
          fontWeight: '600',
          color: '#0f172a',
          marginTop: '10px',
        }}
      >
        £{property.price.toLocaleString()}
      </p>

      <p style={{ marginTop: '10px', fontSize: '16px', color: '#475569' }}>
        🛏 {property.bedrooms} beds • 🛁 {property.bathrooms || 0} bath
      </p>

      <p
        style={{
          marginTop: '14px',
          fontSize: '15px',
          lineHeight: '1.6',
          color: '#334155',
        }}
      >
        {property.description || 'No description available.'}
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '14px',
          backgroundColor: '#ecfdf5',
          padding: '16px',
          borderRadius: '10px',
          marginTop: '24px',
          fontWeight: 500,
          color: '#065f46',
          fontSize: '15px',
        }}
      >
        <div>📈 Yield: {property.yield_percent || 0}%</div>
        <div>💰 ROI: {property.roi_percent || 0}%</div>
        <div>🏷 Property Type: {property.propertyType || 'N/A'}</div>
        <div>📊 Investment Type: {property.investmentType || 'N/A'}</div>
        <div>🔗 Source: {property.source || 'Unknown'}</div>
      </div>
    </div>
  );
}
