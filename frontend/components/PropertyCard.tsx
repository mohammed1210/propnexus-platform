'use client';

import Link from 'next/link';
import { fetchWithRetry } from '@/lib/api';
import ImageWithFallback from '@/components/ImageWithFallback';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiHeart } from 'react-icons/fi';
import { buildVerdict, verdictToneClasses } from '@/lib/verdict';
import { FF } from '@/lib/flags';

// tiny classnames helper – keeps conditional class logic tidy
function cx(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(' ');
}

type Property = {
  id: string;
  title: string;
  source?: string | null;
  location?: string | null;
  price?: number | null;
  asking_price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  description?: string | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  ai_score?: number | null;
  score?: number | null;
  recommended_score?: number | null;
  deal_reasons?: string[];
  deal_signals?: string[];
  discount_estimate_pct?: number | null;
  discount_percent?: number | null;
  imageurl?: string | null;
  image_urls?: string[] | null;
  // Optional fields some feeds may include; used for “provided rent” detection.
  rent?: number | null;
  monthly_rent?: number | null;
  rent_pcm?: number | null;
  rent_per_month?: number | null;
};

type InsightsPayload = {
  postcode?: string;
  fetched_at?: string;
  area?: any;
  comps?: any;
  error?: string;
};

type InsightsCacheEntry = {
  fetchedAtMs: number;
  postcode: string;
  payload: InsightsPayload;
};

const insightsCache = new Map<string, InsightsCacheEntry>();

function extractLikelyUkPostcode(text: string): string | null {
  const t = String(text || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return null;

  // Full postcode (very common in listing location strings). Store without spaces.
  // Example: SW1A 1AA, M1 1AE, EC1V9LB
  const full = t.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})\b/);
  if (full) return `${full[1]}${full[2]}`;

  // Outward-only fallback (e.g. SW11, E8, W1K). Avoid pure numbers.
  const outward = t.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\b/);
  return outward ? outward[1] : null;
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
      const res = await fetch(url, {
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

// Badge color thresholds for yield and ROI percentages
const YIELD_THRESHOLD_EXCELLENT = 6; // >= 6% is green
const YIELD_THRESHOLD_GOOD = 4; // >= 4% is amber, < 4% is red
const ROI_THRESHOLD_EXCELLENT = 12; // >= 12% is green
const ROI_THRESHOLD_GOOD = 8; // >= 8% is amber, < 8% is red

function formatSourceBadge(source: string | null | undefined): string {
  const raw = (source ?? '').trim();
  const normalized = raw.toLowerCase();

  if (normalized === 'zoopla') return 'Zoopla';
  if (normalized === 'rightmove') return 'Rightmove';
  if (normalized === 'onthemarket' || normalized === 'otm') return 'OTM';
  if (normalized === 'spareroom') return 'SpareRoom';
  if (!raw) return 'Unknown';

  // Fallback: capitalize first character (keep rest as-is)
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function getSourceBadgeClasses(source: string | null | undefined): string {
  const normalized = (source ?? '').trim().toLowerCase();

  // Requested brand colors:
  // - Zoopla: purple
  // - Rightmove: turquoise
  // - OTM: redish/maroon
  if (normalized === 'zoopla') {
    return 'bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-700';
  }
  if (normalized === 'rightmove') {
    return 'bg-teal-100 text-teal-800 border border-teal-200 dark:bg-teal-900/30 dark:text-teal-200 dark:border-teal-700';
  }
  if (normalized === 'onthemarket' || normalized === 'otm') {
    return 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-700';
  }

  return 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700';
}

export default function PropertyCard({
  p,
  showDealReasonChip,
  isHovered,
  onHoverChange,
}: {
  p: Property;
  showDealReasonChip?: boolean;
  isHovered?: boolean;
  onHoverChange?: (hovered: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const articleRef = useRef<HTMLElement | null>(null);
  const [shouldLoadInsights, setShouldLoadInsights] = useState(false);

  const [insights, setInsights] = useState<InsightsCacheEntry | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsErr, setInsightsErr] = useState<string | null>(null);
  const [timeTick, setTimeTick] = useState(0);

  const postcodeKey = useMemo(() => {
    const haystack = `${p.location ?? ''} ${p.title ?? ''} ${p.description ?? ''}`;
    return extractLikelyUkPostcode(haystack);
  }, [p.description, p.location, p.title]);

  const dealChipText = useMemo(() => {
    if (!Array.isArray(p.deal_reasons) || !p.deal_reasons[0]) return null;

    const sigs = Array.isArray(p.deal_signals) ? p.deal_signals : [];
    const hasReduced = sigs.some((s) => String(s).toLowerCase() === 'reduced');
    const disc = typeof p.discount_estimate_pct === 'number' ? p.discount_estimate_pct : null;
    if (hasReduced && disc !== null && isFinite(disc) && disc > 0) {
      return `~${Math.round(disc)}% below prior ask`;
    }
    return p.deal_reasons[0];
  }, [p.deal_reasons, p.deal_signals, p.discount_estimate_pct]);

  useEffect(() => {
    // Only hydrate the insights payloads once the card is near the viewport.
    if (shouldLoadInsights) return;
    if (!(FF.AREA_INTEL || FF.COMPS)) return;

    const el = articleRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoadInsights(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setShouldLoadInsights(true);
          obs.disconnect();
        }
      },
      { rootMargin: '240px' },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [shouldLoadInsights]);

  useEffect(() => {
    // Tick once a minute so “Updated Xm ago” stays trustworthy.
    if (!insights) return;
    const id = window.setInterval(() => setTimeTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [insights]);

  useEffect(() => {
    if (!shouldLoadInsights) return;
    if (!(FF.AREA_INTEL || FF.COMPS)) return;
    if (!postcodeKey) {
      setInsights(null);
      setInsightsErr(null);
      setInsightsLoading(false);
      return;
    }

    const cached = insightsCache.get(postcodeKey);
    if (cached) {
      setInsights(cached);
      setInsightsErr(null);
      setInsightsLoading(false);
      return;
    }

    let cancelled = false;
    const ctrl = new AbortController();
    setInsightsLoading(true);
    setInsightsErr(null);

    (async () => {
      try {
        const qs = new URLSearchParams();
        if (FF.AREA_INTEL) qs.set('area', '1');
        if (FF.COMPS) qs.set('comps', '1');

        const res = await fetch(`/api/insights/${encodeURIComponent(postcodeKey)}?${qs.toString()}`, {
          method: 'GET',
          cache: 'no-store',
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as InsightsPayload;

        const entry: InsightsCacheEntry = {
          fetchedAtMs: Date.now(),
          postcode: postcodeKey,
          payload,
        };
        insightsCache.set(postcodeKey, entry);
        if (!cancelled) setInsights(entry);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        if (!cancelled) {
          setInsights(null);
          setInsightsErr('Insights unavailable');
        }
      } finally {
        if (!cancelled) setInsightsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [postcodeKey, shouldLoadInsights]);

  const derived = useMemo(() => {
    const out: {
      rentMonthly?: number;
      rentSource?: 'provided';
      grossYieldPct?: number;
      priceToRent?: number;
      crimeLabel?: 'Low' | 'Med' | 'High';
      schoolsRating?: number;
      compsMedianSold?: number;
      compsCount?: number;
      freshnessText?: string;
      cacheTag?: string;
    } = {};

    const price = typeof p.price === 'number' && p.price > 0 ? p.price : undefined;
    const providedRent = [p.monthly_rent, p.rent_pcm, p.rent_per_month, p.rent]
      .map((v) => (typeof v === 'number' ? v : undefined))
      .find((v) => typeof v === 'number' && isFinite(v) && v > 0);

    const area = insights?.payload?.area && !insights?.payload?.area?.error ? insights.payload.area : null;
    const comps = insights?.payload?.comps && !insights?.payload?.comps?.error ? insights.payload.comps : null;

    // Rent estimate
    if (providedRent) {
      out.rentMonthly = Math.round(providedRent);
      out.rentSource = 'provided';
    }

    // Yield (only when explicitly provided on the property)
    const providedYield = typeof p.yield_percent === 'number' && isFinite(p.yield_percent) ? p.yield_percent : undefined;
    if (typeof providedYield === 'number') out.grossYieldPct = providedYield;

    // Price-to-rent (annual)
    if (price && out.rentMonthly) out.priceToRent = price / (out.rentMonthly * 12);

    // Crime + schools
    const crime = typeof area?.crime_index === 'number' ? area.crime_index : undefined;
    if (typeof crime === 'number') {
      out.crimeLabel = crime < 40 ? 'Low' : crime < 70 ? 'Med' : 'High';
    }
    if (typeof area?.schools_rating === 'number') out.schoolsRating = area.schools_rating;

    // Comps: use DB medians/count (no provider arrays)
    if (typeof comps?.count === 'number') out.compsCount = comps.count;
    if (typeof comps?.median_price === 'number' && isFinite(comps.median_price) && comps.median_price > 0) {
      out.compsMedianSold = comps.median_price;
    }

    // Freshness + cache tag
    if (insights?.fetchedAtMs) {
      const mins = Math.max(0, Math.floor((Date.now() - insights.fetchedAtMs) / 60_000));
      out.freshnessText = mins === 0 ? 'Updated just now' : `Updated ${mins}m ago`;

      const areaSrc = insights.payload?.area?.source;
      const compsSrc = insights.payload?.comps?.source;
      const anyDb = areaSrc === 'db' || compsSrc === 'db';
      out.cacheTag = anyDb ? 'DB' : undefined;
    }

    // Touch timeTick to keep freshness recomputed.
    void timeTick;
    return out;
  }, [insights, p.monthly_rent, p.price, p.rent, p.rent_pcm, p.rent_per_month, p.yield_percent, timeTick]);

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
      await postJSON<{ ok: boolean }>(`/api/save-deal`, {
        property_id: p.id,
      });
      setSaveSuccess(true);
    } catch (e) {
      console.error(e);
      alert('Could not save this deal.');
    } finally {
      setSaving(false);
    }
  }, [p.id]);

  const imageSrc =
    p.imageurl ||
    (Array.isArray(p.image_urls) && p.image_urls.length > 0 ? p.image_urls[0] : null) ||
    '/placeholder.jpg';

  const descriptionSnippet = useMemo(() => {
    if (!p.description) return '';
    const trimmed = p.description.trim();
    if (trimmed.length <= 180) return trimmed;
    return trimmed.slice(0, 177) + '...';
  }, [p.description]);

  const sourceBadgeText = useMemo(() => formatSourceBadge(p.source), [p.source]);
  const sourceBadgeClasses = useMemo(() => getSourceBadgeClasses(p.source), [p.source]);

  const verdict = useMemo(() => buildVerdict(p), [p]);

  return (
    <article
      ref={(n) => {
        articleRef.current = n;
      }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      className={cx(
        'card p-0 overflow-hidden transition-all hover:shadow-lg hover:border-primary/30',
        isHovered && 'ring-2 ring-brand-500/20 border-brand-500/30',
      )}
    >
      <Link
        href={href}
        className="block relative w-full h-48 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary group"
        aria-label={`Open ${p.title ?? 'property'}`}
      >
        <ImageWithFallback
          src={imageSrc}
          alt={p.title || 'Property image'}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          style={{ objectFit: 'cover' }}
          className="transition-transform duration-300 group-hover:scale-110"
          loading="lazy"
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
            'active:scale-[0.98]',
            saveSuccess
              ? 'bg-white/95 backdrop-blur-sm text-red-600 dark:text-red-400 border-2 border-white/60 hover:bg-white hover:border-white shadow-md'
              : 'bg-white/90 backdrop-blur-sm text-slate-900 border-2 border-white/50 hover:bg-white hover:border-white shadow-md',
            (saving || saveSuccess) && 'cursor-not-allowed',
          )}
          aria-label={
            saveSuccess ? 'Deal saved successfully' : saving ? 'Saving deal' : 'Save this property'
          }
          aria-pressed={saveSuccess}
          title={saveSuccess ? 'Saved to Deals' : 'Save to Deals'}
        >
          {saveSuccess ? (
            <>
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="currentColor"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
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
          {typeof p.score === 'number' && (
            <span
              className={cx(
                'text-xs font-semibold px-2 py-1 rounded-md backdrop-blur-sm',
                'bg-slate-900/60 text-white dark:bg-slate-50/10 dark:text-slate-100',
              )}
              aria-label={`Deal score: ${Math.round(p.score)}/100`}
              title={`Deal score: ${Math.round(p.score)}/100`}
            >
              Score {Math.round(p.score)}
            </span>
          )}
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

      {descriptionSnippet && (
        <div className="px-4 pt-3 text-sm text-slate-700 dark:text-slate-300 line-clamp-3">
          {descriptionSnippet}
        </div>
      )}

      <div className="p-4 space-y-2">
        <Link href={href} className="block group">
          <div className="mb-1">
            <span
              className={cx(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                sourceBadgeClasses,
              )}
              aria-label={`Source: ${sourceBadgeText}`}
              title={`Source: ${sourceBadgeText}`}
            >
              {sourceBadgeText}
            </span>
          </div>
          <h3 className="font-semibold leading-snug line-clamp-2 group-hover:underline">
            {p.title || 'Untitled property'}
          </h3>
        </Link>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">{p.location || '—'}</p>

        {(FF.AREA_INTEL || FF.COMPS) && (
          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 tracking-wide uppercase">
                Insights
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {derived.freshnessText ? derived.freshnessText : ''}
                {derived.cacheTag ? ` · ${derived.cacheTag}` : ''}
              </div>
            </div>

            {showDealReasonChip && dealChipText && Array.isArray(p.deal_reasons) && p.deal_reasons[0] && (
              <div className="mt-2">
                <span
                  className={cx(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                    'border-slate-200 text-slate-700 bg-slate-50',
                    'dark:border-slate-700 dark:text-slate-200 dark:bg-slate-800/60',
                  )}
                  aria-label={`Deal reason: ${dealChipText}`}
                  title={p.deal_reasons.slice(0, 3).join(' • ')}
                >
                  {dealChipText}
                </span>
              </div>
            )}

            {postcodeKey ? (
              <div className="mt-2">
                {insightsLoading ? (
                  <div className="space-y-1.5">
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-5/6" />
                  </div>
                ) : insightsErr ? (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{insightsErr}</div>
                ) : (
                  <div className="space-y-1 text-[11px]">
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {typeof derived.rentMonthly === 'number' && (
                        <span className="text-slate-700 dark:text-slate-200">
                          Rent <span className="font-semibold">£{derived.rentMonthly.toLocaleString()}/mo</span>
                        </span>
                      )}
                      {typeof derived.grossYieldPct === 'number' && isFinite(derived.grossYieldPct) && (
                        <span className="text-slate-700 dark:text-slate-200">
                          Yield <span className="font-semibold">{derived.grossYieldPct.toFixed(1)}%</span>
                        </span>
                      )}
                      {typeof derived.priceToRent === 'number' && isFinite(derived.priceToRent) && (
                        <span className="text-slate-700 dark:text-slate-200">
                          P/R <span className="font-semibold">{derived.priceToRent.toFixed(1)}x</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {derived.crimeLabel && (
                        <span className="text-slate-700 dark:text-slate-200">
                          Crime <span className="font-semibold">{derived.crimeLabel}</span>
                        </span>
                      )}
                      {typeof derived.schoolsRating === 'number' && isFinite(derived.schoolsRating) && (
                        <span className="text-slate-700 dark:text-slate-200">
                          Schools <span className="font-semibold">{derived.schoolsRating.toFixed(1)}/5</span>
                        </span>
                      )}
                      {FF.COMPS && typeof derived.compsCount === 'number' && (
                        <span className="text-slate-700 dark:text-slate-200">
                          Comps{' '}
                          <span className="font-semibold">
                            {typeof derived.compsMedianSold === 'number'
                              ? `£${Math.round(derived.compsMedianSold).toLocaleString()}`
                              : '—'}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {' '}({derived.compsCount})
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Add postcode to load insights.
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cx(
              'inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-semibold',
              verdictToneClasses(verdict.tone),
            )}
            aria-label={`Verdict: ${verdict.label}`}
            title={verdict.sentence}
          >
            {verdict.label}
          </span>
          {verdict.highlights.map((h) => (
            <span key={h} className="text-xs text-slate-600 dark:text-slate-400">
              {h}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-sm">
            <span className="font-medium">{priceText}</span>
            <span className="opacity-60 ml-2">
              {p.bedrooms ?? '—'} bd · {p.bathrooms ?? '—'} ba
            </span>
          </div>
        </div>

        {/* Deal Pulse (micro row) */}
        {(derived.rentMonthly || derived.crimeLabel || typeof derived.compsCount === 'number') && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-700 dark:text-slate-200">
            {derived.rentMonthly ? (
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cx('inline-block h-2 w-2 rounded-sm', 'bg-slate-400/70 dark:bg-slate-500/60')}
                />
                <span className="text-slate-600 dark:text-slate-400">
                  Rent:
                </span>
                <span className="font-semibold">£{(derived.rentMonthly / 1000).toFixed(1)}k/mo</span>
              </span>
            ) : null}

            {(() => {
              const n = typeof derived.compsCount === 'number' ? derived.compsCount : undefined;
              const schools = typeof derived.schoolsRating === 'number' ? derived.schoolsRating : undefined;
              if (n == null && schools == null) return null;

              let label: 'High' | 'Avg' | 'Low' = 'Avg';
              if ((typeof n === 'number' && n >= 6) || (typeof schools === 'number' && schools >= 4.0)) label = 'High';
              else if ((typeof n === 'number' && n <= 1) && (typeof schools === 'number' && schools < 3.0)) label = 'Low';

              const dot =
                label === 'High'
                  ? 'bg-teal-500/70'
                  : label === 'Avg'
                    ? 'bg-amber-500/60'
                    : 'bg-slate-400/70 dark:bg-slate-500/60';

              return (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={cx('inline-block h-2 w-2 rounded-full', dot)} />
                  <span className="text-slate-600 dark:text-slate-400">Area demand:</span>
                  <span className="font-semibold">{label}</span>
                </span>
              );
            })()}

            {derived.crimeLabel ? (
              (() => {
                const label = derived.crimeLabel === 'Low' ? 'Good' : derived.crimeLabel === 'Med' ? 'Avg' : 'Risk';
                const dot =
                  label === 'Good'
                    ? 'bg-teal-500/70'
                    : label === 'Avg'
                      ? 'bg-amber-500/60'
                      : 'bg-slate-400/70 dark:bg-slate-500/60';
                return (
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className={cx('inline-block h-2 w-2 rounded-sm', dot)} />
                    <span className="text-slate-600 dark:text-slate-400">Safety:</span>
                    <span className="font-semibold">{label}</span>
                  </span>
                );
              })()
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}
