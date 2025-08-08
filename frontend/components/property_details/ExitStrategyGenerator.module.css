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

type ParsedStrategy = {
  title: string;
  summary: string;
};

/* ---------- Helpers ---------- */

// strip basic markdown & bullets
function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, '$1')       // **bold**
    .replace(/__(.*?)__/g, '$1')           // __bold__
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1')   // `code`
    .replace(/^\s*[-*•]\s*/gm, '')         // bullet prefixes
    .replace(/\s+/g, ' ')                  // collapse whitespace
    .trim();
}

// Try to parse: "Title: details" or "Title – details"
function parseOne(raw: string): ParsedStrategy {
  const cleaned = stripMarkdown(raw);
  const m = cleaned.match(/^([^:.–—-]{3,100})\s*[:–—-]\s*(.+)$/); // title : summary
  if (m) {
    return { title: m[1].trim(), summary: m[2].trim() };
  }
  // fallback: first sentence as title
  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  const rest = cleaned.slice(firstSentence.length).trim();
  return {
    title: firstSentence.replace(/^\d+\.\s*/, '').trim(),
    summary: rest,
  };
}

// Normalise any backend shape into string[]
function normaliseItems(data: unknown): string[] {
  if (!data) return [];
  if (Array.isArray(data)) return data.map(String);
  if (typeof data === 'string') {
    return data
      .split(/\n+/)
      .map((s) => s.replace(/^\s*\d+\.\s*/, '').trim())
      .filter(Boolean);
  }
  // common wrapper { strategies: [...] }
  const maybe = (data as any)?.strategies;
  if (Array.isArray(maybe)) return maybe.map(String);
  try {
    return [String(data)];
  } catch {
    return [];
  }
}

export default function ExitStrategyGenerator(props: ExitStrategyProps) {
  const {
    title,
    location,
    price,
    yield_percent,
    roi_percent,
    propertyType,
    investmentType,
    description = '',
  } = props;

  const [rawItems, setRawItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL;

  const parsed = useMemo(() => rawItems.map(parseOne), [rawItems]);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setRawItems([]);
    setGeneratedAt(null);

    try {
      if (!BACKEND_BASE) throw new Error('Missing NEXT_PUBLIC_API_URL');

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
      const items = normaliseItems(data);
      setRawItems(items);
      setGeneratedAt(new Date());
    } catch (err: any) {
      console.error('Exit strategies error:', err);
      setError(err?.message || 'An error occurred while generating strategies.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    const text = parsed
      .map((p, i) => `${i + 1}. ${p.title}${p.summary ? ` — ${p.summary}` : ''}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h3 className={styles.heading}>💼 Exit Strategy Suggestions</h3>
        <div className={styles.actions}>
          {parsed.length > 0 && (
            <button className={styles.secondaryBtn} onClick={handleCopy} type="button">
              Copy
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className={styles.generateButton}
            type="button"
          >
            {loading ? 'Thinking…' : 'Generate Exit Strategies'}
          </button>
        </div>
      </div>

      <p className={styles.caption}>
        Use AI to suggest smart exit plans tailored to this property.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      {parsed.length > 0 && (
        <div className={styles.result}>
          <ol className={styles.list}>
            {parsed.map((item, idx) => (
              <li key={idx} className={styles.item}>
                <span className={styles.itemTitle}>{item.title}</span>
                {item.summary && <span className={styles.itemSummary}>{item.summary}</span>}
              </li>
            ))}
          </ol>
          {generatedAt && (
            <div className={styles.meta}>
              Last generated at {generatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
