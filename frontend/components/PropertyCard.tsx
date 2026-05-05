'use client';

import Link from 'next/link';
import { fetchWithRetry } from '@/lib/api';
import ImageWithFallback from '@/components/ImageWithFallback';
import { Highlight } from '@/components/Highlight';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { FiBarChart2, FiChevronLeft, FiChevronRight, FiHeart, FiHome, FiMapPin, FiTarget, FiTrendingUp } from 'react-icons/fi';
import { buildVerdict, verdictToneClasses } from '@/lib/verdict';
import { FF } from '@/lib/flags';
import { track } from '@/lib/events';
import { formatPercent, getRoiDisplay, getYieldPercent, normalizeProperty } from '@/lib/normalizeProperty';
import { Badge } from '@/components/Badges';

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
  matches?: string[] | null;
  badges?: string[] | null;
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
  queryId,
  queryText,
  filters,
  rank,
}: {
  p: Property;
  showDealReasonChip?: boolean;
  isHovered?: boolean;
  onHoverChange?: (hovered: boolean) => void;
  queryId?: string | null;
  queryText?: string | null;
  filters?: Record<string, unknown>;
  rank?: number;
}) {
  const { userId } = useAuth();
  const normalized = useMemo(() => normalizeProperty(p as any), [p]);
  const displayScore = useMemo(() => {
    const raw = typeof p.ai_score === 'number' ? p.ai_score : p.score;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  }, [p.ai_score, p.score]);

  const displayYieldPct = useMemo(
    () => getYieldPercent(normalized as any) ?? getYieldPercent(p as any),
    [normalized, p],
  );
  const roiDisplay = useMemo(() => {
    const a = getRoiDisplay(p as any);
    if (a.value != null) return a;
    return getRoiDisplay((normalized as any)?.raw ?? (normalized as any));
  }, [normalized, p]);
  const displayRoiPct = roiDisplay.value;

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

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
      rentSource?: 'provided' | 'proxy';
      grossYieldPct?: number;
      priceToRent?: number;
      crimeLabel?: 'Low' | 'Med' | 'High';
      schoolsRating?: number;
      compsMedianSold?: number;
      compsCount?: number;
      compsDateRange?: string;
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
    const compRents: number[] = Array.isArray(comps?.rents)
      ? comps.rents
          .map((r: any) => Number(r?.monthly_rent ?? r?.rent ?? r?.pcm ?? 0))
          .filter((n: number) => Number.isFinite(n) && n > 0)
      : [];
    const compRentMedian = compRents.length ? median(compRents) : undefined;
    const areaRent = typeof area?.avg_rent === 'number' && area.avg_rent > 0 ? area.avg_rent : undefined;

    if (providedRent) {
      out.rentMonthly = Math.round(providedRent);
      out.rentSource = 'provided';
    } else if (typeof compRentMedian === 'number') {
      out.rentMonthly = Math.round(compRentMedian);
      out.rentSource = 'proxy';
    } else if (typeof areaRent === 'number') {
      out.rentMonthly = Math.round(areaRent);
      out.rentSource = 'proxy';
    }

    // Yield (prefer normalized yield; otherwise proxy)
    const providedYield = typeof normalized.yieldPercent === 'number' && isFinite(normalized.yieldPercent)
      ? normalized.yieldPercent
      : undefined;
    if (typeof providedYield === 'number') out.grossYieldPct = providedYield;
    else if (price && out.rentMonthly) out.grossYieldPct = (out.rentMonthly * 12 * 100) / price;

    // Price-to-rent (annual)
    if (price && out.rentMonthly) out.priceToRent = price / (out.rentMonthly * 12);

    // Crime + schools
    const crime = typeof area?.crime_index === 'number' ? area.crime_index : undefined;
    if (typeof crime === 'number') {
      out.crimeLabel = crime < 40 ? 'Low' : crime < 70 ? 'Med' : 'High';
    }
    if (typeof area?.schools_rating === 'number') out.schoolsRating = area.schools_rating;

    // Comps: median sold + count + date range
    const salesArr: any[] = Array.isArray(comps?.sales) ? comps.sales : [];
    const salePrices: number[] = salesArr
      .map((s) => Number(s?.price ?? s?.sold_price ?? s?.soldPrice ?? 0))
      .filter((n) => Number.isFinite(n) && n > 0);
    const saleDates: number[] = salesArr
      .map((s) => Date.parse(String(s?.date ?? s?.sold_date ?? s?.soldDate ?? s?.sold_at ?? '')))
      .filter((t) => Number.isFinite(t) && t > 0);

    out.compsCount = salePrices.length;
    if (salePrices.length) out.compsMedianSold = median(salePrices);
    if (saleDates.length) {
      const min = new Date(Math.min(...saleDates));
      const max = new Date(Math.max(...saleDates));
      out.compsDateRange = `${min.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}–${max.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}`;
    }

    // Freshness + cache tag
    if (insights?.fetchedAtMs) {
      const mins = Math.max(0, Math.floor((Date.now() - insights.fetchedAtMs) / 60_000));
      out.freshnessText = mins === 0 ? 'Updated just now' : `Updated ${mins}m ago`;

      const areaSrc = insights.payload?.area?.source;
      const compsSrc = insights.payload?.comps?.source;
      const anyProvider = areaSrc === 'provider' || compsSrc === 'provider';
      const anyCache = areaSrc === 'cache' || compsSrc === 'cache';
      out.cacheTag = anyProvider ? 'Live' : anyCache ? 'Cached' : undefined;
    }

    // Touch timeTick to keep freshness recomputed.
    void timeTick;
    return out;
  }, [insights, normalized.yieldPercent, p.monthly_rent, p.price, p.rent, p.rent_pcm, p.rent_per_month, timeTick]);

  function median(nums: number[]): number {
    const a = [...nums].sort((x, y) => x - y);
    const mid = Math.floor(a.length / 2);
    if (!a.length) return NaN;
    return a.length % 2 === 1 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

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

  const imageSources = useMemo(() => {
    const seen = new Set<string>();
    const rawSources = [
      p.imageurl,
      ...(Array.isArray(p.image_urls) ? p.image_urls : []),
    ];

    const sources = rawSources
      .map((src) => (typeof src === 'string' ? src.trim() : ''))
      .filter((src) => {
        if (!src || seen.has(src)) return false;
        seen.add(src);
        return true;
      });

    return sources.length > 0 ? sources : ['/placeholder.jpg'];
  }, [p.image_urls, p.imageurl]);

  useEffect(() => {
    setCarouselIndex((index) => (index >= imageSources.length ? 0 : index));
  }, [imageSources.length]);

  const imageSrc = imageSources[carouselIndex] ?? imageSources[0] ?? '/placeholder.jpg';
  const hasCarousel = imageSources.length > 1;

  const matchInfo = useMemo(() => {
    const raw = Array.isArray(p.matches) ? p.matches : [];
    const terms = new Set<string>();
    let exact = false;
    let synonym = false;
    let fuzzy = false;

    for (const item of raw) {
      const value = String(item || '').trim();
      if (!value) continue;

      if (value.startsWith('keyword:')) {
        exact = true;
        const term = value.split(':').pop();
        if (term) terms.add(term.toLowerCase());
        continue;
      }

      if (value.startsWith('synonym:')) {
        synonym = true;
        const term = value.split(':').pop();
        if (term) terms.add(term.toLowerCase());
        continue;
      }

      if (value.startsWith('fuzzy:')) {
        fuzzy = true;
        const term = value.split(':').pop();
        if (term) terms.add(term.toLowerCase());
      }
    }

    return {
      hasAny: exact || synonym || fuzzy,
      exact,
      synonym,
      fuzzy,
      tokens: Array.from(terms),
    };
  }, [p.matches]);

  const sourceBadgeText = useMemo(() => formatSourceBadge(p.source), [p.source]);
  const sourceBadgeClasses = useMemo(() => getSourceBadgeClasses(p.source), [p.source]);

  const verdict = useMemo(() => buildVerdict(p), [p]);

  const handleSearchClickTrack = useCallback(() => {
    if (!p.id) return;
    void track('search_click', {
      queryId,
      queryText,
      listingId: p.id,
      filters,
      rank,
      clerkUserId: userId,
    });
  }, [filters, p.id, queryId, queryText, rank, userId]);

  return (
    <article
      ref={(n) => {
        articleRef.current = n;
      }}
      data-testid="property-card"
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      className={cx(
        'property-card group/card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-2xl hover:shadow-slate-950/10 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-brand-700',
        isHovered && 'ring-2 ring-brand-500/20 border-brand-500/40 shadow-xl shadow-brand-950/10',
      )}
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden">
        <Link
          href={href}
          onClick={handleSearchClickTrack}
          className="group block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Open ${p.title ?? 'property'}`}
        >
          <ImageWithFallback
            key={imageSrc}
            src={imageSrc}
            alt={p.title || 'Property image'}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            style={{ objectFit: 'cover' }}
            className="transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
            priority={false}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-transparent opacity-70" aria-hidden="true" />
        </Link>

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
            'absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
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

        {hasCarousel && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCarouselIndex((index) => (index - 1 + imageSources.length) % imageSources.length);
              }}
              className="absolute left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/50 bg-white/85 text-slate-900 shadow-sm backdrop-blur-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white dark:bg-slate-950/75 dark:text-white dark:hover:bg-slate-900"
              aria-label="Show previous property image"
            >
              <FiChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCarouselIndex((index) => (index + 1) % imageSources.length);
              }}
              className="absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/50 bg-white/85 text-slate-900 shadow-sm backdrop-blur-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white dark:bg-slate-950/75 dark:text-white dark:hover:bg-slate-900"
              aria-label="Show next property image"
            >
              <FiChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-slate-950/45 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm" aria-hidden="true">
              {carouselIndex + 1}/{imageSources.length}
            </div>
          </>
        )}

      </div>

      <div className="space-y-2.5 p-3.5">
        <Link href={href} onClick={handleSearchClickTrack} className="block group">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span
              className={cx(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold',
                sourceBadgeClasses,
              )}
              aria-label={`Source: ${sourceBadgeText}`}
              title={`Source: ${sourceBadgeText}`}
            >
              {sourceBadgeText}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-300">
              Investor view
            </span>
          </div>
          <h3 className="text-[15px] font-black leading-snug text-slate-950 line-clamp-2 transition-colors group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-300">
            <Highlight text={p.title || 'Untitled property'} tokens={matchInfo.tokens} />
          </h3>
        </Link>

        {matchInfo.hasAny && (
          <div className="flex flex-wrap gap-1">
            {matchInfo.exact && (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-900/20 dark:text-emerald-300">
                exact
              </span>
            )}
            {matchInfo.synonym && (
              <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:border-violet-700/60 dark:bg-violet-900/20 dark:text-violet-300">
                synonym
              </span>
            )}
            {matchInfo.fuzzy && (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300">
                fuzzy
              </span>
            )}
          </div>
        )}

        {Array.isArray(p.badges) && p.badges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {p.badges.map((badgeId) => (
              <Badge key={badgeId} id={String(badgeId)} />
            ))}
          </div>
        )}

        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
          <FiMapPin className="h-3.5 w-3.5 shrink-0 text-brand-500" aria-hidden="true" />
          <span className="truncate">{p.location || '—'}</span>
        </p>

        <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/90 via-white to-emerald-50/60 p-1.5 shadow-sm dark:border-brand-900/50 dark:from-brand-950/30 dark:via-slate-950 dark:to-emerald-950/20">
          <div className="rounded-xl border border-white/80 bg-white px-1.5 py-2 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
            <div className="mx-auto mb-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              <FiTarget className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Score</div>
            <div className="text-base font-black leading-tight text-slate-950 dark:text-white">
              {typeof displayScore === 'number' ? Math.round(displayScore) : '—'}
            </div>
          </div>
          <div className="rounded-xl border border-white/80 bg-white px-1.5 py-2 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
            <div className="mx-auto mb-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <FiTrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Yield</div>
            <div className="text-base font-black leading-tight text-slate-950 dark:text-white">
              {typeof displayYieldPct === 'number' ? formatPercent(displayYieldPct) : '—'}
            </div>
          </div>
          <div className="rounded-xl border border-white/80 bg-white px-1.5 py-2 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
            <div className="mx-auto mb-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
              <FiBarChart2 className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">ROI</div>
            <div className="text-base font-black leading-tight text-slate-950 dark:text-white">
              {typeof displayRoiPct === 'number' ? formatPercent(displayRoiPct) : '—'}
            </div>
          </div>
        </div>

        {(FF.AREA_INTEL || FF.COMPS) && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900/30">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 tracking-wide uppercase">
                Market pulse
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {derived.freshnessText ? derived.freshnessText : ''}
                {derived.cacheTag ? ` · ${derived.cacheTag}` : ''}
              </div>
            </div>

            {showDealReasonChip && dealChipText && Array.isArray(p.deal_reasons) && p.deal_reasons[0] && (
              <div className="mt-1.5">
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
              <div className="mt-1.5">
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
                          <span className="text-slate-500 dark:text-slate-400">
                            {' '}
                            ({derived.rentSource === 'provided' ? 'provided' : 'proxy'})
                          </span>
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
                            {' '}
                            ({derived.compsCount}){derived.compsDateRange ? ` · ${derived.compsDateRange}` : ''}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                Add postcode to load insights.
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 dark:border-slate-800">
          <span
            className={cx(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
              verdictToneClasses(verdict.tone),
            )}
            aria-label={`Verdict: ${verdict.label}`}
            title={verdict.sentence}
          >
            {verdict.label}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-slate-50 to-brand-50/60 px-2.5 py-1.5 dark:from-slate-900/60 dark:to-brand-950/30">
          <div className="text-[13px]">
            <span className="font-black text-slate-950 dark:text-white">{priceText}</span>
            <span className="opacity-70 ml-2 inline-flex items-center gap-1 text-xs">
              <FiHome className="h-3.5 w-3.5" aria-hidden="true" />
              {p.bedrooms ?? '—'} bd · {p.bathrooms ?? '—'} ba
            </span>
          </div>
          <span className="text-xs font-bold text-brand-600 transition-colors group-hover/card:text-brand-700 dark:text-brand-300">
            View details →
          </span>
        </div>
      </div>
    </article>
  );
}
