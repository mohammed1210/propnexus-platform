'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Property } from '../../../types';

export default function PropertyDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
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
        padding: '20px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
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
          marginBottom: '20px',
          backgroundColor: '#f1f5f9',
        }}
      />
      <h1 style={{ fontSize: '28px', marginBottom: '10px' }}>{property.title}</h1>
      <p style={{ fontSize: '18px', color: '#64748b' }}>{property.location}</p>
      <p style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '6px' }}>
        £{property.price.toLocaleString()}
      </p>
      <p style={{ margin: '10px 0', fontSize: '16px' }}>
        🛏 {property.bedrooms} beds • 🛁 {property.bathrooms || 0} bath
      </p>
      <p style={{ marginBottom: '16px', fontSize: '15px', color: '#334155' }}>
        {property.description || 'No description available.'}
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#ecfdf5',
          padding: '12px 16px',
          borderRadius: '10px',
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