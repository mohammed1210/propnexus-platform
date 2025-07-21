'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Property } from '../../../types';
import supabase from '@lib/supabaseClient';

export default function PropertyDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id!;
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`https://propnexus-backend-production.up.railway.app/properties/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setProperty(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    const userId = 'demo-user';
    const { error } = await supabase.from('saved_deals').insert({
      user_id: userId,
      property_id: property?.id,
    });

    if (error) {
      console.error('Error saving deal:', error.message);
      alert('Failed to save deal!');
    } else {
      alert('Deal saved!');
    }
  };

  if (!id) return <p>Invalid property ID.</p>;
  if (loading) return <p>Loading...</p>;
  if (!property) return <p>Property not found.</p>;

  return (
    <div style={{
      maxWidth: '1280px',
      margin: '40px auto',
      padding: '24px',
      display: 'flex',
      flexDirection: 'row',
      gap: '32px',
    }}>
      <div style={{ flex: 2 }}>
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

        <h1 style={{ fontSize: '30px', fontWeight: '700', color: '#0f172a' }}>
          {property.title}
        </h1>
        <p style={{ fontSize: '18px', color: '#64748b', marginBottom: '8px' }}>
          {property.location}
        </p>
        <p style={{ fontSize: '24px', fontWeight: '600', color: '#0f172a' }}>
          £{property.price.toLocaleString()}
        </p>
        <p style={{ marginTop: '10px', fontSize: '16px', color: '#475569' }}>
          🛏 {property.bedrooms} beds • 🛁 {property.bathrooms || 0} bath
        </p>

        <h2 style={{ marginTop: '28px', fontSize: '20px', color: '#1e293b', fontWeight: 600 }}>
          Description
        </h2>
        <p style={{
          marginTop: '8px',
          fontSize: '15px',
          lineHeight: '1.7',
          color: '#334155'
        }}>
          {property.description || 'No description available.'}
        </p>
      </div>

      <div style={{
        flex: 1,
        position: 'sticky',
        top: '40px',
        alignSelf: 'flex-start',
        padding: '20px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      }}>
        <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: '#1e293b' }}>
          Deal Summary
        </h3>

        <div style={{ marginBottom: '8px', color: '#0f172a' }}>
          <strong>Yield:</strong> {property.yield_percent || 0}%
        </div>
        <div style={{ marginBottom: '8px', color: '#0f172a' }}>
          <strong>ROI:</strong> {property.roi_percent || 0}%
        </div>
        <div style={{ marginBottom: '8px', color: '#0f172a' }}>
          <strong>Property Type:</strong> {property.propertyType || 'N/A'}
        </div>
        <div style={{ marginBottom: '8px', color: '#0f172a' }}>
          <strong>Investment Type:</strong> {property.investmentType || 'N/A'}
        </div>
        <div style={{ marginBottom: '16px', color: '#0f172a' }}>
          <strong>Source:</strong> {property.source || 'Unknown'}
        </div>

        <button
          onClick={handleSave}
          style={{
            marginTop: '12px',
            backgroundColor: '#14b8a6',
            color: 'white',
            padding: '12px 20px',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%',
            fontSize: '15px',
          }}
        >
          💾 Save Deal
        </button>
      </div>
    </div>
  );
}
