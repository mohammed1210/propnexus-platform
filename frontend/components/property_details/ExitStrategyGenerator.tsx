'use client';

import { useState } from 'react';

type ExitStrategyGeneratorProps = {
  price: number;
  yield_percent: number;
  roi_percent: number;
  investmentType?: string;
};

export default function ExitStrategyGenerator({
  price,
  yield_percent,
  roi_percent,
  investmentType = 'Buy-to-Let',
}: ExitStrategyGeneratorProps) {
  const [strategies, setStrategies] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setStrategies(null);

    try {
      const res = await fetch('/api/generate-strategy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price,
          yield_percent,
          roi_percent,
          investmentType,
        }),
      });

      const data = await res.json();

      if (res.ok && data.strategies) {
        setStrategies(data.strategies);
      } else {
        setError('Failed to generate strategies.');
      }
    } catch (err) {
      setError('Error generating strategies.');
    }

    setLoading(false);
  };

  return (
    <div
      style={{
        marginTop: '32px',
        padding: '24px',
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
      }}
    >
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>
        📈 Exit Strategy Generator
      </h2>
      <p style={{ fontSize: '15px', color: '#475569', marginBottom: '12px' }}>
        Suggests potential exit routes based on deal figures and investment type.
      </p>

      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{
          padding: '10px 16px',
          borderRadius: '8px',
          backgroundColor: '#14b8a6',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        {loading ? 'Generating...' : '🔍 Generate Strategies'}
      </button>

      {error && (
        <p style={{ marginTop: '12px', color: '#ef4444' }}>{error}</p>
      )}

      {strategies && (
        <ul style={{ marginTop: '16px', paddingLeft: '20px' }}>
          {strategies.map((strategy, index) => (
            <li key={index} style={{ marginBottom: '10px', color: '#1e293b' }}>
              ✅ {strategy}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
