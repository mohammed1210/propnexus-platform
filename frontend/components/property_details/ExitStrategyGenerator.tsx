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
}

export default function ExitStrategyGenerator({
  title,
  location,
  price,
  yield_percent,
  roi_percent,
  propertyType,
  investmentType,
}: ExitStrategyProps) {
  const [strategies, setStrategies] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/generate-strategy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          property: {
            title,
            location,
            price,
            yield_percent,
            roi_percent,
            propertyType,
            investmentType,
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStrategies(data.strategies);
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Network error or server not responding.');
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

      {strategies && (
        <div className={styles.result}>
          <pre>{strategies}</pre>
        </div>
      )}
    </div>
  );
}
