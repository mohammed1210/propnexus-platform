'use client';

import { useMemo, useState } from 'react';
import styles from './ExitStrategyGenerator.module.css';

/** Minimal shape we care about (loose + nullable for safety) */
type LooseProperty = {
  title?: string | null;
  location?: string | null;
  price?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  propertyType?: string | null;
  investmentType?: string | null;
  description?: string | null;
};

/** Props: either pass a single `property` OR the individual fields */
type Props =
  | { property: LooseProperty }
  | {
      title?: string;
      location?: string;
      price?: number;
      yield_percent?: number;
      roi_percent?: number;
      propertyType?: string;
      investmentType?: string;
      description?: string;
    };

type StrategyInput =
  | string
  | {
      strategy?: string;
      text?: string;
      title?: string;
      content?: string;
      description?: string;
    }
  | unknown;

/* --- Helpers ------------------------------------------------------------- */

// Support either env var name
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '').trim();

function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^\s*[-•]\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(item: StrategyInput): string {
  if (!item) return '';
  if (typeof item === 'string') return stripMarkdown(item);

  if (typeof item === 'object') {
    const o = item as Record<string, unknown>;
    const fields = [o.strategy, o.text, o.title, o.content, o.description];
    const str = fields.find((v) => typeof v === 'string') as string | undefined;
    if (str) return stripMarkdown(str);
    try {
      return stripMarkdown(JSON.stringify(o));
    } catch {
      return String(o);
    }
  }
  return String(item);
}

function splitBlobToList(blob: string): string[] {
  const lines = blob
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(\d+\.|[-•])\s*/, '').trim())
    .filter(Boolean);

  if (lines.length > 1) return lines.map(stripMarkdown);
  return [stripMarkdown(blob)];
}

/* --- Component ----------------------------------------------------------- */

export default function ExitStrategyGenerator(props: Props) {
  const merged: LooseProperty = 'property' in props ? props.property ?? {} : props;

  const title = merged.title ?? '';
  const location = merged.location ?? '';
  const price = merged.price ?? 0;
  const yield_percent = merged.yield_percent ?? 0;
  const roi_percent = merged.roi_percent ?? 0;
  const propertyType = merged.propertyType ?? '';
  const investmentType = merged.investmentType ?? '';
  const description = merged.description ?? '';

  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);

  const timeLabel = useMemo(
    () =>
      generatedAt
        ? generatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '',
    [generatedAt]
  );

  async function handleGenerate() {
    setLoading(true);
    setError('');
    setItems([]);

    try {
      if (!API_BASE) throw new Error('Missing NEXT_PUBLIC_API_URL');

      const res = await fetch(`${API_BASE}/generate-strategies`, {
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

      if (!res.ok) throw new Error(`Strategies API ${res.status}: ${await res.text()}`);

      const data = await res.json();

      let out: string[] = [];
      if (Array.isArray(data)) {
        out = data.map(normalize).filter(Boolean);
      } else if (Array.isArray((data as any)?.strategies)) {
        out = (data as any).strategies.map(normalize).filter(Boolean);
      } else if (typeof data === 'string') {
        out = splitBlobToList(data);
      } else {
        const maybe = normalize(data);
        if (maybe) out = [maybe];
      }

      setItems(out);
      setGeneratedAt(new Date());
    } catch (e: any) {
      console.error('Exit strategies error:', e);
      setError(e?.message || 'An error occurred while generating strategies.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!items.length) return;
    const text = items.map((s, i) => `${i + 1}. ${s}`).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore clipboard failures */
    }
  }

  return (
    <div className={styles.container} aria-live="polite">
      <div className={styles.headerRow}>
        <div>
          <h3 className={styles.heading}>💼 Exit Strategy Suggestions</h3>
          <p className={styles.caption}>
            Use AI to suggest smart exit plans tailored to this property.
          </p>
        </div>

        <div className={styles.toolbar}>
          <button
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={handleCopy}
            disabled={!items.length || loading}
            aria-label="Copy strategies to clipboard"
            title={items.length ? 'Copy to clipboard' : 'No strategies to copy yet'}
          >
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? 'Thinking…' : 'Generate Exit Strategies'}
          </button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {items.length > 0 && (
        <div className={styles.result}>
          <ol className={styles.list}>
            {items.map((s, i) => {
              const [t, ...rest] = s.split(':');
              const titleLine = t?.trim();
              const descLine = rest.join(':').trim();

              return (
                <li key={i}>
                  <div className={styles.titleLine}>{titleLine || `Strategy ${i + 1}`}</div>
                  {!!descLine && <div className={styles.descLine}>{descLine}</div>}
                </li>
              );
            })}
          </ol>

          {!!timeLabel && (
            <div className={styles.timestamp}>Last generated at {timeLabel}</div>
          )}
        </div>
      )}
    </div>
  );
}