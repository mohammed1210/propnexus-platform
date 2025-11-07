'use client';

import Link from 'next/link';
import { fetchWithRetry } from '@/lib/api';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiHeart } from 'react-icons/fi';

// tiny classnames helper – keeps conditional class logic tidy
function cx(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(' ');
}

type Property = {
  id: string;
  title: string;
  location?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  imageurl?: string | null;
};

/** Resolve the FastAPI base URL from public env (trim TRAILING slashes only) */
function getBackendBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    '') as string;

  if (!raw) {
    throw new Error('NEXT_PUBLIC_API_URL (or NEXT_PUBLIC_BACKEND_URL) is not set');
  }
  // Keep https:// and path segments intact; only strip trailing slashes.
  return raw.replace(/\/+$/, '');
}

/** JSON POST with timeout + small retry for resilience */
async function postJSON<T>(
  url: string,
  body: unknown,
  { timeoutMs = 10000, retries = 1 }: { timeoutMs?: number; retries?: number } = {},
): Promise<T> {
  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= retries) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const id = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

    try {
      const res = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller?.signal,
      });
      if (!res.ok) {
        // retry only on transient-ish codes
        if (![408, 429, 500, 502, 503, 504].includes(res.status) || attempt === retries) {
          throw new Error(`POST ${url} failed (${res.status})`);
        }
        throw new Error(`retryable-${res.status}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      attempt += 1;
      if (attempt > retries) break;
      // jittered backoff
      await new Promise((r) =>
        setTimeout(r, 300 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200)),
      );
    } finally {
      if (id) clearTimeout(id);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// Duration in milliseconds to show the "Saved" success state
const SAVE_SUCCESS_DURATION_MS = 1500;

// Badge color thresholds for yield and ROI percentages
const YIELD_THRESHOLD_EXCELLENT = 6; // >= 6% is green
const YIELD_THRESHOLD_GOOD = 4; // >= 4% is amber, < 4% is red
const ROI_THRESHOLD_EXCELLENT = 12; // >= 12% is green
const ROI_THRESHOLD_GOOD = 8; // >= 8% is amber, < 8% is red

export default function PropertyCard({ p }: { p: Property }) {
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const priceText = useMemo(() => {
    const n = p.price ?? 0;
    try {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `£${Number(n).toLocaleString()}`;
    }
  }, [p.price]);

  const href = useMemo(() => `/property/${encodeURIComponent(p.id)}`, [p.id]);

  // Helper to determine badge color based on value and thresholds
  const getBadgeColor = (type: 'yield' | 'roi', value: number) => {
    if (type === 'yield') {
      if (value >= YIELD_THRESHOLD_EXCELLENT)
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      if (value >= YIELD_THRESHOLD_GOOD)
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    } else {
      // ROI
      if (value >= ROI_THRESHOLD_EXCELLENT)
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      if (value >= ROI_THRESHOLD_GOOD)
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    }
  };

  const handleSaveDeal = useCallback(async () => {
    try {
      setSaving(true);
      const base = getBackendBase();
      await postJSON<{ ok: boolean }>(`${base}/save-deal`, {
        property_id: p.id,
      });
      setSaveSuccess(true);
      // Clear any existing timeout
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      // Revert success state after 1.5s
      successTimeoutRef.current = setTimeout(() => setSaveSuccess(false), SAVE_SUCCESS_DURATION_MS);
    } catch (e) {
      console.error(e);
      alert('Could not save this deal.');
    } finally {
      setSaving(false);
    }
  }, [p.id]);

  return (
    <article className="card p-0 overflow-hidden transition-all hover:shadow-lg hover:border-primary/30">
      <Link
        href={href}
        className="block relative w-full h-48 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary group"
        aria-label={`Open ${p.title ?? 'property'}`}
      >
        <Image
          src={p.imageurl || '/placeholder.jpg'}
          alt={p.title || 'Property image'}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          style={{ objectFit: 'cover' }}
          className="transition-transform duration-300 group-hover:scale-110"
          priority={false}
        />
        
        {/* Sprint 11.3: Prominent Save button in top-left */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSaveDeal();
          }}
          disabled={saving || saveSuccess}
          className={cx(
            'absolute top-2 left-2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
            saveSuccess
              ? 'bg-green-600 text-white border-2 border-white shadow-lg save-animation'
              : 'bg-white/90 backdrop-blur-sm text-slate-900 border-2 border-white/50 hover:bg-white hover:border-white shadow-md',
            (saving || saveSuccess) && 'cursor-not-allowed',
          )}
          aria-label={
            saveSuccess ? 'Deal saved successfully' : saving ? 'Saving deal' : 'Save this property'
          }
          aria-pressed={saveSuccess}
          title={saveSuccess ? 'Saved' : 'Save this property'}
        >
          {saveSuccess ? (
            <>
              <FiHeart className="w-4 h-4 fill-current" />
              <span className="text-xs font-semibold">Saved</span>
            </>
          ) : saving ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span className="text-xs">Saving…</span>
            </>
          ) : (
            <>
              <FiHeart className="w-4 h-4" />
              <span className="text-xs font-semibold">Save</span>
            </>
          )}
        </button>
        
        {/* Badges for yield and ROI - moved to top-right */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {typeof p.yield_percent === 'number' && (
            <span
              className={cx(
                'text-xs font-semibold px-2 py-1 rounded-md backdrop-blur-sm',
                getBadgeColor('yield', p.yield_percent),
              )}
              aria-label={`Yield percentage: ${p.yield_percent.toFixed(1)}%`}
            >
              {p.yield_percent.toFixed(1)}% Yield
            </span>
          )}
          {typeof p.roi_percent === 'number' && (
            <span
              className={cx(
                'text-xs font-semibold px-2 py-1 rounded-md backdrop-blur-sm',
                getBadgeColor('roi', p.roi_percent),
              )}
              aria-label={`ROI percentage: ${p.roi_percent.toFixed(1)}%`}
            >
              {p.roi_percent.toFixed(1)}% ROI
            </span>
          )}
        </div>
      </Link>

      <div className="p-4 space-y-2">
        <Link href={href} className="block group">
          <h3 className="font-semibold leading-snug line-clamp-2 group-hover:underline">
            {p.title || 'Untitled property'}
          </h3>
        </Link>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">{p.location || '—'}</p>

        <div className="flex items-center justify-between pt-2">
          <div className="text-sm">
            <span className="font-medium">{priceText}</span>
            <span className="opacity-60 ml-2">
              {p.bedrooms ?? '—'} bd · {p.bathrooms ?? '—'} ba
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
