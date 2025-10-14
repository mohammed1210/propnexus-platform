'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type BudgetPreset =
  | { label: '≤£150k'; min: number | null; max: number | null }
  | { label: '£150k–£300k'; min: number | null; max: number | null }
  | { label: '£300k–£500k'; min: number | null; max: number | null }
  | { label: '£500k+'; min: number | null; max: number | null };

const PRESETS: BudgetPreset[] = [
  { label: '≤£150k', min: null, max: 150_000 },
  { label: '£150k–£300k', min: 150_000, max: 300_000 },
  { label: '£300k–£500k', min: 300_000, max: 500_000 },
  { label: '£500k+', min: 500_000, max: null },
];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function fmtGBP(n: number | null) {
  if (n == null) return '';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(n);
}

function parseIntSafe(v: string | null) {
  if (!v) return null;
  const n = parseInt(v.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

// Serialise as price=MIN-MAX (nulls omitted)
function encodePriceParam(min: number | null, max: number | null) {
  const left = min != null ? String(min) : '';
  const right = max != null ? String(max) : '';
  if (!left && !right) return null;
  return `${left}-${right}`;
}

function decodePriceParam(raw: string | null): { min: number | null; max: number | null } {
  if (!raw) return { min: null, max: null };
  const [a, b] = raw.split('-');
  const min = a ? parseInt(a, 10) : null;
  const max = b ? parseInt(b, 10) : null;
  return {
    min: Number.isFinite(min as number) ? (min as number) : null,
    max: Number.isFinite(max as number) ? (max as number) : null,
  };
}

export default function BudgetFilter({
  minBounds = 0,
  maxBounds = 1_500_000,
  step = 5_000,
  storageKey = 'propnexus:budget',
}: {
  minBounds?: number;
  maxBounds?: number;
  step?: number;
  storageKey?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // --- helpers that safely read the URL params (no “possibly null”) ---
  const spGet = (key: string) => (sp ? sp.get(key) : null);
  const spToString = () => (sp ? sp.toString() : '');

  // read initial state from URL or localStorage
  const initial = useMemo(() => {
    const fromUrl = decodePriceParam(spGet('price'));
    if (fromUrl.min != null || fromUrl.max != null) return fromUrl;

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as { min: number | null; max: number | null };
    } catch {}
    return { min: null, max: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally not depending on URL/localStorage for initial load

  const [min, setMin] = useState<number | null>(initial.min);
  const [max, setMax] = useState<number | null>(initial.max);

  // keep URL in sync (debounced-ish)
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(spToString()); // ✅ safe
      const encoded = encodePriceParam(min, max);
      if (encoded) {
        params.set('price', encoded);
      } else {
        params.delete('price');
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });

      // persist locally
      try {
        localStorage.setItem(storageKey, JSON.stringify({ min, max }));
      } catch {}
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, pathname, router]); // (params source comes from spToString())
  // --------------------------------------------------------------------

  // handle input changes
  const onMinChange = (v: string) => {
    const n = parseIntSafe(v);
    if (n == null) {
      setMin(null);
      return;
    }
    const clamped = clamp(n, minBounds, maxBounds);
    setMin(clamped);
    if (max != null && clamped > max) setMax(clamped);
  };

  const onMaxChange = (v: string) => {
    const n = parseIntSafe(v);
    if (n == null) {
      setMax(null);
      return;
    }
    const clamped = clamp(n, minBounds, maxBounds);
    setMax(clamped);
    if (min != null && clamped < min) setMin(clamped);
  };

  const clear = () => {
    setMin(null);
    setMax(null);
  };

  // detect active preset
  const activePreset = useMemo(() => {
    return (
      PRESETS.find((p) => (p.min ?? null) === (min ?? null) && (p.max ?? null) === (max ?? null))
        ?.label ?? null
    );
  }, [min, max]);

  // (Optional) dual slider only on wide screens
  const showSlider = typeof window !== 'undefined' && window.innerWidth >= 1024;

  return (
    <div className="budget-filter">
      <div className="bf-row">
        <span className="bf-label">Budget</span>
        <div className="bf-presets">
          {PRESETS.map((p) => {
            const isActive = activePreset === p.label;
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={isActive}
                className={`bf-chip ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setMin(p.min);
                  setMax(p.max);
                }}
                title={`Set budget to ${p.label}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <button type="button" className="bf-clear" onClick={clear} aria-label="Clear budget">
          Clear
        </button>
      </div>

      <div className="bf-row">
        <div className="bf-input">
          <label htmlFor="minPrice">Min</label>
          <input
            id="minPrice"
            inputMode="numeric"
            placeholder="£ Min"
            value={min == null ? '' : String(min)}
            onChange={(e) => onMinChange(e.target.value)}
          />
          <span className="bf-value">{fmtGBP(min)}</span>
        </div>

        <div className="bf-sep">—</div>

        <div className="bf-input">
          <label htmlFor="maxPrice">Max</label>
          <input
            id="maxPrice"
            inputMode="numeric"
            placeholder="£ Max"
            value={max == null ? '' : String(max)}
            onChange={(e) => onMaxChange(e.target.value)}
          />
          <span className="bf-value">{fmtGBP(max)}</span>
        </div>
      </div>

      {showSlider && (
        <div className="bf-slider">
          {/* two overlapped range inputs emulate a dual-handle slider without a library */}
          <input
            type="range"
            min={minBounds}
            max={maxBounds}
            step={step}
            value={min ?? minBounds}
            onChange={(e) => onMinChange(e.target.value)}
          />
          <input
            type="range"
            min={minBounds}
            max={maxBounds}
            step={step}
            value={max ?? maxBounds}
            onChange={(e) => onMaxChange(e.target.value)}
          />
          <div className="bf-track">
            <div
              className="bf-range"
              style={{
                left: `${(((min ?? minBounds) - minBounds) / (maxBounds - minBounds)) * 100}%`,
                right: `${(1 - ((max ?? maxBounds) - minBounds) / (maxBounds - minBounds)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <style jsx>{`
        .budget-filter {
          display: grid;
          gap: 8px;
        }
        .bf-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .bf-label {
          font-weight: 600;
        }
        .bf-presets {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .bf-chip {
          border: 1px solid var(--border, #d0d5dd);
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 0.9rem;
          background: var(--chip-bg, #fff);
        }
        .bf-chip.active {
          border-color: var(--primary, #0ea5e9);
          box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.15);
        }
        .bf-clear {
          margin-left: auto;
          font-size: 0.9rem;
          text-decoration: underline;
          opacity: 0.8;
        }
        .bf-input {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 6px;
          align-items: center;
          min-width: 160px;
        }
        .bf-input > label {
          grid-column: 1 / -1;
          font-size: 0.8rem;
          opacity: 0.8;
        }
        .bf-input > input {
          width: 100%;
          border: 1px solid var(--border, #d0d5dd);
          border-radius: 10px;
          padding: 8px 10px;
          background: var(--bg, #fff);
        }
        .bf-value {
          font-size: 0.85rem;
          opacity: 0.8;
          min-width: 80px;
          text-align: right;
        }
        .bf-sep {
          opacity: 0.4;
        }
        .bf-slider {
          position: relative;
          height: 26px;
          display: grid;
          align-items: center;
          margin-top: 6px;
        }
        .bf-slider input[type='range'] {
          position: absolute;
          left: 0;
          right: 0;
          width: 100%;
          pointer-events: none; /* stacked */
          background: none;
          -webkit-appearance: none;
          appearance: none;
        }
        .bf-slider input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: var(--thumb, #0ea5e9);
          border: 2px solid white;
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
          pointer-events: auto;
          cursor: pointer;
        }
        .bf-track {
          position: absolute;
          left: 0;
          right: 0;
          height: 6px;
          border-radius: 999px;
          background: #e5e7eb;
        }
        .bf-range {
          position: absolute;
          top: 0;
          bottom: 0;
          border-radius: 999px;
          background: var(--primary, #0ea5e9);
        }
        :global(.dark) .bf-chip {
          background: #0b1220;
          border-color: #223;
        }
        :global(.dark) .bf-input > input {
          background: #0b1220;
          border-color: #223;
        }
        :global(.dark) .bf-track {
          background: #162036;
        }
      `}</style>
    </div>
  );
}
