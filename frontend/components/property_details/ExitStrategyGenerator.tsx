'use client';

import React, { useMemo, useState } from 'react';
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

function normalizeStrategy(item: unknown): string {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    const candidates = [obj.strategy, obj.text, obj.title, obj.content, obj.description];
    const first = candidates.find(
      (v) => typeof v === 'string' && (v as string).trim().length > 0
    );
    if (typeof first === 'string') return first.trim();
    try {
      return JSON.stringify(obj);
    } catch {
      return String(obj);
    }
  }
  return String(item);
}

// Clean up bullets like "- ..." or "• ..." and drop empties
function sanitizeList(lines: string[]): string[] {
  return lines
    .map((l) => l.replace(/^\s*[-•]\s*/, '').trim())
    .filter((l) => l.length > 0);
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
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);

  const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL;

  const hasResults = strategies.length > 0;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(strategies.map((s, i) => `${i + 1}. ${s}`).join('\n'));
    } catch {
      // ignore
    }
  };

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
        items = data.map(normalizeStrategy);
      } else if (Array.isArray((data as any)?.strategies)) {
        items = (data as any).strategies.map(normalizeStrategy);
      } else if (typeof data === 'string') {
        items = data.split(/\n+/).map((s) => s.trim());
      } else {
        const maybe = normalizeStrategy(data);
        if (maybe) items = [maybe];
      }

      items = sanitizeList(items);

      if (items.length === 0) {
        setError('No strategies were returned. Try again in a moment.');
      } else {
        setStrategies(items);
        setLastGeneratedAt(new Date());
      }
    } catch (err: any) {
      console.error('Exit strategies error:', err);
      setError(err?.message || 'An error occurred while generating strategies.');
    } finally {
      setLoading(false);
    }
  };

  const generatedAtLabel = useMemo(() => {
    if (!lastGeneratedAt) return '';
    const t = lastGeneratedAt;
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    return `Last generated at ${hh}:${mm}`;
  }, [lastGeneratedAt]);

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h3 className={styles.heading}>💼 Exit Strategy Suggestions</h3>
          <p className={styles.caption}>
            Use AI to suggest smart exit plans tailored to this property.
          </p>
        </div>

        <div className={styles.actions}>
          {hasResults && (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={copyToClipboard}
              aria-label="Copy strategies to clipboard"
            >
              Copy
            </button>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className={styles.generateButton}
          >
            {loading ? (
              <>
                <span className={styles.spinner} aria-hidden />
                Thinking…
              </>
            ) : (
              'Generate Exit Strategies'
            )}
          </button>
        </div>
      </div>

      {/* Status + error */}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      {/* Results */}
      <div className={styles.result} aria-live="polite">
        {!loading && !hasResults && !error && (
          <p className={styles.empty}>
            No strategies yet. Click <strong>Generate</strong> to create a short, actionable list (3–5 items).
          </p>
        )}

        {hasResults && (
          <>
            <ol className={styles.list}>
              {strategies.map((strat, idx) => (
                <li key={idx} className={styles.listItem}>
                  {strat}
                </li>
              ))}
            </ol>

            {generatedAtLabel && (
              <p className={styles.timestamp} aria-label={generatedAtLabel}>
                {generatedAtLabel}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
