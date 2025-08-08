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
  const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL;

  function normalizeStrategy(item: unknown): string {
    if (!item) return '';
    if (typeof item === 'string') return item.trim();
    if (typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      // common fields that LLM/backends might use
      const candidates = [
        obj.strategy,
        obj.text,
        obj.title,
        obj.content,
        obj.description,
      ];
      const first = candidates.find(
        (v) => typeof v === 'string' && (v as string).trim().length > 0
      );
      if (typeof first === 'string') return first.trim();

      // fallback: stringify safely
      try {
        return JSON.stringify(obj);
      } catch {
        return String(obj);
      }
    }
    return String(item);
  }

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setStrategies([]);

    try {
      if (!BACKEND_BASE) {
        throw new Error('Missing NEXT_PUBLIC_API_URL');
      }

      const res = await fetch(`${BACKEND_BASE}/generate-strategies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          location,
          price,
          yield_percent,
          roi_percent,
          property_type: propertyType,
          investment_type: investmentType,
          description,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Strategies API ${res.status}: ${text}`);
      }

      const data = await res.json();

      let items: string[] = [];
      if (Array.isArray(data)) {
        items = data.map(normalizeStrategy).filter(Boolean);
      } else if (Array.isArray((data as any)?.strategies)) {
        items = (data as any).strategies.map(normalizeStrategy).filter(Boolean);
      } else if (typeof data === 'string') {
        // Split lines if the API returned a single string blob
        items = data
          .split(/\n+/)
          .map((s) => s.replace(/^\s*[-•]\s*/, '').trim())
          .filter(Boolean);
      } else {
        // final fallback
        const maybe = normalizeStrategy(data);
        if (maybe) items = [maybe];
      }

      setStrategies(items);
    } catch (err: any) {
      console.error('Exit strategies error:', err);
      setError(err?.message || 'An error occurred while generating strategies.');
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

      <button
        onClick={handleGenerate}
        disabled={loading}
        className={styles.generateButton}
      >
        {loading ? 'Thinking…' : 'Generate Exit Strategies'}
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
