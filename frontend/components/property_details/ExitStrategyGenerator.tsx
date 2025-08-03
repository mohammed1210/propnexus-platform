'use client';

import React, { useState } from 'react';
import styles from './ExitStrategyGenerator.module.css';

interface ExitStrategyProps {
  title: string;
  location: string;
  price: number;
  yield_percent: number;
  roi_percent: number;
  propertyType: string;
  investmentType: string;
  description?: string;
}

export default function ExitStrategyGenerator({
  title,
  location,
  price,
  yield_percent,
  roi_percent,
  propertyType,
  investmentType,
  description = '',
}: ExitStrategyProps) {
  const [strategies, setStrategies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setStrategies([]);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate-strategies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price,
          roi_percent,
          yield_percent,
          location,
          property_type: propertyType,
          description,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to fetch strategies');
      }

      const data = await res.json();
      setStrategies(data.strategies || []);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>💼 Exit Strategy Suggestions</h3>
      <p className={styles.caption}>
        Use AI to suggest smart exit plans tailored to this property.
      </p>

      <button onClick={handleGenerate} disabled={loading} className={styles.generateButton}>
        {loading ? 'Thinking...' : 'Generate Exit Strategies'}
      </button>

      {error && <p className={styles.error}>{error}</p>}

      {strategies.length > 0 && (
        <div className={styles.result}>
          <ul>
            {strategies.map((strat, idx) => (
              <li key={idx}>{strat}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
