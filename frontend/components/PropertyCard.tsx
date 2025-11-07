'use client';

import Link from 'next/link';
import { fetchWithRetry } from '@/lib/api';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
      if (value >= 6) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      if (value >= 4)
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    } else {
      // ROI
      if (value >= 12) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      if (value >= 8)
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
        className="block relative w-full h-48 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`Open ${p.title ?? 'property'}`}
      >
        <Image
          src={p.imageurl || '/placeholder.jpg'}
          alt={p.title || 'Property image'}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          style={{ objectFit: 'cover' }}
          priority={false}
        />
        {/* Badges for yield and ROI */}
        <div className="absolute top-2 right-2 flex gap-1">
          {typeof p.yield_percent === 'number' && p.yield_percent > 0 && (
            <span
              className={cx(
                'text-xs font-semibold px-2 py-1 rounded-md',
                getBadgeColor('yield', p.yield_percent),
              )}
              aria-label={`Yield percentage: ${p.yield_percent.toFixed(1)}%`}
            >
              {p.yield_percent.toFixed(1)}% Yield
            </span>
          )}
          {typeof p.roi_percent === 'number' && p.roi_percent > 0 && (
            <span
              className={cx(
                'text-xs font-semibold px-2 py-1 rounded-md',
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

          <button
            type="button"
            onClick={handleSaveDeal}
            disabled={saving || saveSuccess}
            className={cx(
              'rounded-md px-3 py-1.5 text-sm border transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              saveSuccess
                ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800',
              (saving || saveSuccess) && 'cursor-not-allowed',
            )}
            aria-label={
              saveSuccess ? 'Deal saved successfully' : saving ? 'Saving deal' : 'Save deal'
            }
          >
            {saveSuccess ? (
              <span className="flex items-center gap-1">
                Saved <span>✓</span>
              </span>
            ) : saving ? (
              <span className="flex items-center gap-1">
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
                Saving…
              </span>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
