'use client';

import { useEffect, useState } from 'react';
import { Property } from '@/types';

interface InvestmentSummaryProps {
  property: Property;
}

export default function InvestmentSummary({ property }: InvestmentSummaryProps) {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!property) return;

    const fetchSummary = async () => {
      try {
        const res = await fetch('/api/generate-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ property }),
        });

        const data = await res.json();
        setSummary(data.summary || 'No summary available.');
      } catch (err) {
        console.error('Failed to fetch summary:', err);
        setSummary('An error occurred while generating the summary.');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [property]);

  return (
    <div style={{
      backgroundColor: '#f8fafc',
      padding: '16px',
      borderRadius: '10px',
      border: '1px solid #e2e8f0',
      marginTop: '24px',
    }}>
      <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b', marginBottom: '10px' }}>
        📈 Investment Summary
      </h2>
      {loading ? (
        <p style={{ color: '#64748b' }}>Generating smart investment summary...</p>
      ) : (
        <p style={{ fontSize: '15px', lineHeight: '1.6', color: '#334155' }}>{summary}</p>
      )}
    </div>
  );
}
