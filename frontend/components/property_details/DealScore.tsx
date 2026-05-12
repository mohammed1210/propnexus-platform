// frontend/components/property_details/DealScore.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiActivity,
  FiAlertTriangle,
  FiBarChart2,
  FiHome,
  FiMapPin,
  FiShield,
  FiTrendingUp,
} from 'react-icons/fi';
import { getAreaIntel, getComps } from '@/lib/api';
import { buildDealScoreFactors, type AreaIntelEvidence, type CompsEvidence, type DisplayScoreFactor } from '@/lib/dealScoreFactors';
import { formatRoiDisplay, getRoiProxyValidationNote, normalizeProperty } from '@/lib/normalizeProperty';
import MetricExplainer from './MetricExplainer';

interface PropertyData {
  ai_score?: number | null;
  score?: number | null;
  score_breakdown?: {
    version?: string;
    categories?: Record<string, number>;
  } | null;
  [key: string]: any;
}

interface DealScoreProps {
  property: PropertyData;
}

const FACTOR_ICONS: Record<string, typeof FiTrendingUp> = {
  yield: FiTrendingUp,
  roi: FiActivity,
  price_to_rent: FiHome,
  area_demand: FiMapPin,
  reported_crime: FiShield,
  schools_access: FiBarChart2,
};

function clampScore(n: number) {
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
}

function fmtPct(n: number | null | undefined) {
  return typeof n === 'number' && Number.isFinite(n) ? `${n.toFixed(1)}%` : '—';
}

function fmtGBP(n: number | null | undefined) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(n);
}

function normStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function extractUkPostcode(value: unknown): string {
  const s = normStr(value).toUpperCase();
  if (!s) return '';
  const full = s.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i)?.[0];
  if (full) return full.replace(/\s+/g, ' ').trim().toUpperCase();
  const outward = s.match(/\b[A-Z]{1,2}\d{1,2}[A-Z]?\b/i)?.[0];
  return outward ? outward.toUpperCase() : '';
}

function factorToneClasses(tone: DisplayScoreFactor['tone']): string {
  if (tone === 'emerald') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300';
  if (tone === 'amber') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300';
  if (tone === 'rose') return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300';
  if (tone === 'brand') return 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900/60 dark:bg-brand-950/30 dark:text-brand-300';
  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300';
}

type DealVerdict = {
  label: 'Investor-grade' | 'Watchlist' | 'Needs stronger evidence';
  tone: DisplayScoreFactor['tone'];
  summary: string;
};

type VerdictRow = {
  label: string;
  value: string;
  helper: string;
};

type ScoreChartItem = {
  label: string;
  value: number;
  tone: DisplayScoreFactor['tone'];
};

function getDealVerdict(score: number): DealVerdict {
  if (score >= 75) {
    return {
      label: 'Investor-grade',
      tone: 'emerald',
      summary: 'Strong evidence base. Move into offer diligence, not blind bidding.',
    };
  }
  if (score >= 50) {
    return {
      label: 'Watchlist',
      tone: 'amber',
      summary: 'Promising, but validate the assumptions before bidding.',
    };
  }
  return {
    label: 'Needs stronger evidence',
    tone: 'rose',
    summary: 'Require stronger comps, rent proof or discount before proceeding.',
  };
}

function getBestFit(property: PropertyData, factors: DisplayScoreFactor[]): VerdictRow {
  const normalized = normalizeProperty(property as any);
  const text = [property?.title, property?.description, property?.property_type, property?.type, property?.strategy]
    .map(normStr)
    .join(' ')
    .toLowerCase();
  const hasFlipSignal = /refurb|renovat|modernis|development|auction|cash buyer|value[- ]add|project/.test(text);
  const yieldFactor = factors.find((factor) => factor.key === 'yield');
  const ptrFactor = factors.find((factor) => factor.key === 'price_to_rent');
  const roiFactor = factors.find((factor) => factor.key === 'roi');

  if (hasFlipSignal && (!yieldFactor || yieldFactor.value < 60)) {
    return {
      label: 'Best fit',
      value: 'Flip',
      helper: 'Value-add language found; confirm works budget and resale comps.',
    };
  }

  if ((normalized.yieldPercent ?? 0) >= 5 || (yieldFactor?.value ?? 0) >= 55 || (ptrFactor?.value ?? 0) >= 55) {
    return {
      label: 'Best fit',
      value: 'BTL',
      helper: 'Gross yield from available rent evidence is the clearest route.',
    };
  }

  if ((roiFactor?.value ?? 0) >= 65) {
    return {
      label: 'Best fit',
      value: 'Refinance',
      helper: 'Return signal is strongest; verify finance, costs and exit value.',
    };
  }

  return {
    label: 'Best fit',
    value: 'Hold',
    helper: 'Use as a watchlist hold until rent and comparable evidence improves.',
  };
}

function getStrongestFactor(factors: DisplayScoreFactor[]): VerdictRow {
  const strongest = [...factors].sort((a, b) => b.value - a.value)[0];
  if (!strongest) {
    return {
      label: 'Strongest signal',
      value: 'Evidence pending',
      helper: 'Add rent or comparable evidence before relying on the score.',
    };
  }

  return {
    label: 'Strongest signal',
    value: strongest.label,
    helper: strongest.badge === 'Land Registry PPD' ? 'Comps backed by Land Registry PPD.' : strongest.helper,
  };
}

function getMainRisk(factors: DisplayScoreFactor[]): VerdictRow {
  const proxyRoi = factors.find((factor) => factor.key === 'roi' && factor.source === 'derived');
  if (proxyRoi) {
    return {
      label: 'Main check before offer',
      value: 'ROI proxy',
      helper: 'ROI is proxy-based; validate finance and costs.',
    };
  }

  const weakest = [...factors].sort((a, b) => a.value - b.value)[0];
  if (weakest) {
    return {
      label: 'Main check before offer',
      value: weakest.label,
      helper: weakest.key === 'reported_crime'
        ? 'Crime shown only where police.uk full-postcode evidence exists.'
        : weakest.helper,
    };
  }

  return {
    label: 'Main check before offer',
    value: 'Evidence depth',
    helper: 'Validate rent, condition and comparable sales before bidding.',
  };
}

function getBeforeOfferChecks(property: PropertyData, factors: DisplayScoreFactor[]): string[] {
  const normalized = normalizeProperty(property as any);
  const checks: string[] = [];
  const add = (check: string) => {
    if (!checks.includes(check) && checks.length < 3) checks.push(check);
  };

  if (factors.some((factor) => factor.key === 'roi' && factor.source === 'derived') || normalized.roiIsProxy) {
    add('Validate finance, refurb costs and fees.');
  }
  if (factors.some((factor) => factor.key === 'yield' || factor.key === 'price_to_rent')) {
    add('Confirm achievable rent and void assumptions.');
  }
  if (factors.some((factor) => factor.key === 'area_demand' && factor.badge === 'Land Registry PPD')) {
    add('Compare latest Land Registry PPD sales.');
  }
  if (factors.some((factor) => factor.key === 'reported_crime')) {
    add('Review police.uk incidents at full postcode level.');
  }

  add('Inspect condition, lease, EPC and legal pack.');
  add('Stress-test exit value and resale demand.');
  add('Set a walk-away price before bidding.');

  return checks;
}

function chartToneClass(tone: DisplayScoreFactor['tone']): string {
  if (tone === 'emerald') return 'from-emerald-300 to-emerald-500';
  if (tone === 'amber') return 'from-amber-300 to-amber-500';
  if (tone === 'rose') return 'from-rose-300 to-rose-500';
  if (tone === 'brand') return 'from-cyan-300 to-brand-400';
  return 'from-slate-300 to-slate-500';
}

function CompactScoreLogicChart({ score, items, className = '' }: { score: number; items: ScoreChartItem[]; className?: string }) {
  const safeScore = clampScore(Math.round(score));
  const visibleItems = items.slice(0, 4);

  if (visibleItems.length === 0) return null;

  return (
    <div
      data-testid="ai-score-logic-chart"
      className={`max-w-md rounded-2xl border border-white/10 bg-white/[0.08] p-3 shadow-sm backdrop-blur-md ${className}`}
      aria-label="AI score logic chart"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-100">
            Score logic
          </div>
          <div className="text-[11px] text-slate-200/85">How the visible factors support the score</div>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950/35 px-2 py-0.5 text-[10px] font-bold text-white">
          {safeScore}/100
        </span>
      </div>

      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400 transition-[width] duration-700"
          style={{ width: `${safeScore}%` }}
        />
      </div>

      <ul className="space-y-1.5">
        {visibleItems.map((item) => {
          const value = clampScore(item.value);
          return (
            <li key={item.label} className="grid grid-cols-[minmax(86px,0.86fr)_minmax(0,1fr)_34px] items-center gap-2">
              <span className="truncate text-[10px] font-semibold text-slate-100/90">{item.label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
                <span
                  className={`block h-full rounded-full bg-gradient-to-r ${chartToneClass(item.tone)}`}
                  style={{ width: `${value}%` }}
                />
              </span>
              <span className="text-right text-[10px] font-bold text-slate-100/80">{value}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function DealScore({ property }: DealScoreProps) {
  const scoreRef = useRef<HTMLDivElement>(null);
  const scoreButtonRef = useRef<HTMLButtonElement | null>(null);
  const scorePopupRef = useRef<HTMLDivElement | null>(null);

  const normalized = useMemo(() => normalizeProperty(property as any), [property]);
  const [areaIntel, setAreaIntel] = useState<AreaIntelEvidence | null>(null);
  const [comps, setComps] = useState<CompsEvidence | null>(null);

  const scoreData = useMemo(() => {
    const score =
      typeof property?.score === 'number'
        ? property.score
        : typeof property?.ai_score === 'number'
          ? property.ai_score
          : null;
    if (typeof score !== 'number') return null;

    const breakdown = property?.score_breakdown;
    const categories =
      breakdown && typeof breakdown === 'object' ? breakdown.categories : undefined;
    const version = breakdown && typeof breakdown === 'object' ? breakdown.version : undefined;

    return { score, categories: categories ?? undefined, version: version ?? undefined };
  }, [property]);

  const areaKey = useMemo(
    () =>
      normStr((property as any)?.area_key) ||
      normStr((property as any)?.postcode) ||
      extractUkPostcode((property as any)?.location) ||
      normStr(normalized.area) ||
      normStr(normalized.location),
    [normalized.area, normalized.location, property],
  );
  const postcodeKey = useMemo(
    () =>
      extractUkPostcode((property as any)?.postcode) ||
      extractUkPostcode((property as any)?.address) ||
      extractUkPostcode((property as any)?.location) ||
      extractUkPostcode((property as any)?.title) ||
      areaKey,
    [areaKey, property],
  );

  useEffect(() => {
    let cancelled = false;
    setAreaIntel(null);
    setComps(null);

    if (areaKey) {
      getAreaIntel(areaKey)
        .then((payload) => {
          if (!cancelled) setAreaIntel((payload ?? null) as AreaIntelEvidence | null);
        })
        .catch(() => {
          if (!cancelled) setAreaIntel(null);
        });
    }
    if (postcodeKey) {
      getComps(postcodeKey)
        .then((payload) => {
          if (!cancelled) setComps((payload ?? null) as CompsEvidence | null);
        })
        .catch(() => {
          if (!cancelled) setComps(null);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [areaKey, postcodeKey]);

  const evidenceFactors = useMemo(
    () =>
      buildDealScoreFactors({
        property: property as Record<string, unknown>,
        score_breakdown: property?.score_breakdown,
        areaIntel,
        comps,
      }),
    [property, areaIntel, comps],
  );

  // Animation state (kept from prior UX)
  const [isVisible, setIsVisible] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [chartOpen, setChartOpen] = useState(false);
  const [chartPosition, setChartPosition] = useState<{ left: number; top: number; width: number } | null>(null);

  useEffect(() => {
    if (scoreData) {
      setAnimatedScore(scoreData.score);
    }
  }, [scoreData]);

  useEffect(() => {
    const element = scoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isVisible) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.2 },
    );

    observer.observe(element);
    return () => observer.unobserve(element);
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !scoreData) return;

    const duration = 1000;
    const start = performance.now();
    const targetScore = scoreData.score;
    const startScore = animatedScore;

    if (Math.round(startScore) === Math.round(targetScore)) {
      return;
    }

    const animate = (currentTime: number) => {
      const elapsed = currentTime - start;
      const progress = Math.min(elapsed / duration, 1);

      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(startScore + (targetScore - startScore) * easeProgress);

      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [animatedScore, isVisible, scoreData]);

  const updateChartPosition = useCallback(() => {
    const trigger = scoreButtonRef.current;
    if (!trigger || typeof window === 'undefined') return;

    const rect = trigger.getBoundingClientRect();
    const margin = 16;
    const gap = 12;
    const width = Math.min(320, Math.max(240, window.innerWidth - margin * 2));
    const estimatedHeight = 220;
    const below = rect.bottom + gap + estimatedHeight <= window.innerHeight - margin;
    const left = Math.max(margin, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - margin));
    const top = below
      ? rect.bottom + gap
      : Math.max(margin, rect.top - gap - estimatedHeight);

    setChartPosition({ left, top, width });
  }, []);

  useEffect(() => {
    if (!chartOpen) {
      setChartPosition(null);
      return;
    }

    updateChartPosition();
    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node;
      if (!scoreButtonRef.current?.contains(target) && !scorePopupRef.current?.contains(target)) {
        setChartOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setChartOpen(false);
    };
    const onUpdate = () => updateChartPosition();

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onUpdate);
    window.addEventListener('scroll', onUpdate, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onUpdate);
      window.removeEventListener('scroll', onUpdate, true);
    };
  }, [chartOpen, updateChartPosition]);

  if (!scoreData) return null;

  const { score, version } = scoreData;

  const showBreakdown = evidenceFactors.length > 0;

  const roundedScore = Math.round(score);
  const animatedRoundedScore = Math.round(animatedScore);
  const investorVerdict = getDealVerdict(score);
  const bestFit = getBestFit(property, evidenceFactors);
  const strongestFactor = getStrongestFactor(evidenceFactors);
  const mainRisk = getMainRisk(evidenceFactors);
  const beforeOfferChecks = getBeforeOfferChecks(property, evidenceFactors);
  const chartItems = evidenceFactors
    .map((factor) => ({ label: factor.label, value: factor.value, tone: factor.tone }))
    .sort((a, b) => b.value - a.value);
  const showChartTrigger = chartItems.length > 0;
  const normalizedRoiDisplay = {
    value: normalized.roiPercent ?? normalized.roiProxyPercent,
    isProxy: normalized.roiIsProxy,
  };
  const roiValidationNote = getRoiProxyValidationNote(normalizedRoiDisplay);
  const dealBand =
    score >= 75
      ? {
          label: 'Investor-grade opportunity',
          chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
          summary:
            'Strong fundamentals. Prioritise offer strategy, finance terms and diligence checks.',
        }
      : score >= 50
        ? {
            label: 'Watchlist deal',
            chip: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
            summary:
              'Mixed fundamentals. Validate rent, costs and exit assumptions before bidding.',
          }
        : {
            label: 'Needs stronger evidence',
            chip: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300',
            summary:
              'Higher risk profile. Look for price discount, stronger comps or clearer demand.',
          };

  const kpis = [
    { label: 'Gross yield', value: fmtPct(normalized.yieldPercent), helper: 'Income quality', metric: 'gross_yield' as const },
    {
      label: normalized.roiIsProxy ? 'ROI proxy' : 'ROI',
      value: formatRoiDisplay(normalizedRoiDisplay),
      helper: roiValidationNote ?? (normalized.roiIsProxy ? 'Derived estimate' : 'Return potential'),
      metric: 'roi_proxy' as const,
    },
    { label: 'Monthly rent', value: fmtGBP(normalized.rentMonthly), helper: 'Rent evidence' },
  ];

  const getScoreColor = (s: number) => {
    if (s >= 75) return 'text-green-600 dark:text-green-400';
    if (s >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const chartPopup = chartOpen && chartPosition && showChartTrigger && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={scorePopupRef}
          className="fixed z-[1000] rounded-2xl border border-slate-200 bg-slate-950 p-2 text-white shadow-2xl shadow-slate-950/30 dark:border-slate-700"
          style={{ left: chartPosition.left, top: chartPosition.top, width: chartPosition.width, maxWidth: 'calc(100vw - 32px)' }}
          role="dialog"
          aria-label="AI score logic graph"
        >
          <CompactScoreLogicChart score={score} items={chartItems} className="bg-slate-900/95" />
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={scoreRef} className="space-y-4">
      {chartPopup}
      <div
        className={`relative overflow-hidden rounded-[1.35rem] border border-brand-200/70 bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 text-white shadow-sm transition-all duration-700 ease-out motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:opacity-100 motion-reduce:transition-none dark:border-brand-900/60 dark:from-brand-950 dark:via-brand-900 dark:to-brand-800 ${
          isVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-[0.98] opacity-0'
        }`}
      >
        <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-emerald-300/15 blur-3xl" />

        <div className="relative grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.72fr)] lg:items-center">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200 backdrop-blur">
                <FiTrendingUp className="h-3.5 w-3.5 text-emerald-300" />
                Investor scorecard
              </span>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${dealBand.chip}`}
              >
                {dealBand.label}
              </span>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <button
                ref={scoreButtonRef}
                type="button"
                onClick={() => showChartTrigger && setChartOpen((value) => !value)}
                disabled={!showChartTrigger}
                className="relative grid h-32 w-32 shrink-0 place-items-center rounded-full p-2.5 shadow-2xl shadow-black/25 transition hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-default sm:h-36 sm:w-36"
                style={{
                  background: `conic-gradient(rgb(16 185 129) ${clampScore(animatedRoundedScore)}%, rgba(255,255,255,0.12) 0)`,
                }}
                aria-label={showChartTrigger ? `Open AI score logic graph for AI Deal Score ${roundedScore} out of 100` : `AI Deal Score ${roundedScore} out of 100`}
                aria-expanded={showChartTrigger ? chartOpen : undefined}
              >
                <div className="grid h-full w-full place-items-center rounded-full border border-white/10 bg-slate-950/95">
                  <div className="text-center">
                    <div
                      className={`text-5xl font-black leading-none tracking-tight ${getScoreColor(score)}`}
                    >
                      {animatedRoundedScore}
                    </div>
                    <div className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                      / 100
                    </div>
                    {showChartTrigger ? (
                      <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-brand-200">
                        View graph
                      </div>
                    ) : null}
                  </div>
                </div>
              </button>

              <div className="max-w-xl">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-200">
                  AI Deal Score <MetricExplainer metric="ai_score" property={property as any} compact />
                </div>
                <h3 className="mt-1.5 text-xl font-bold tracking-tight text-white sm:text-2xl">
                  Deal quality at a glance
                </h3>
                <p className="mt-2 text-sm leading-5 text-slate-200">{dealBand.summary}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-white/10 bg-white/[0.1] p-3 text-center backdrop-blur-md"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-50/85">
                  {kpi.label}
                  {kpi.metric ? <MetricExplainer metric={kpi.metric} property={property as any} compact /> : null}
                </div>
                <div className="mt-1.5 text-xl font-bold text-white">{kpi.value}</div>
                <div className="mt-1 text-xs text-brand-50/75">{kpi.helper}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showBreakdown ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.78fr)]">
          <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Score drivers
                </div>
                <h4 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                  Evidence-backed score drivers
                </h4>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Evidence-backed factor view</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {evidenceFactors.map((factor) => {
                const Icon = FACTOR_ICONS[factor.key] ?? FiBarChart2;
                return (
                  <div
                    key={factor.key}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-900/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          {factor.label}
                          {factor.key === 'price_to_rent' ? <MetricExplainer metric="price_to_rent" property={property as any} compact /> : null}
                        </div>
                        <div className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
                          {factor.displayValue}
                        </div>
                      </div>
                      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${factorToneClasses(factor.tone)}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {factor.helper}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                        {factor.badge}
                      </span>
                      <span className={`text-sm font-bold ${getScoreColor(factor.value)}`}>{factor.value}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Investor verdict
                </div>
                <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
                  Decision-ready readout
                </h4>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${factorToneClasses(investorVerdict.tone)}`}>
                {investorVerdict.label}
              </span>
            </div>

            <p className="mb-3 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
              {investorVerdict.summary}
            </p>

            <div className="space-y-2.5">
              {[bestFit, strongestFactor, mainRisk].map((row) => (
                <div
                  key={row.label}
                  className="rounded-xl border border-slate-200 bg-white/90 p-3 dark:border-slate-800 dark:bg-slate-950/50"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    {row.label}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                    {row.value}
                  </div>
                  <p className="mt-1 text-xs leading-4 text-slate-500 dark:text-slate-400">
                    {row.helper}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                <FiAlertTriangle className="h-3.5 w-3.5" />
                Before bidding
              </div>
              <ul className="space-y-1.5 text-xs leading-4 text-amber-800 dark:text-amber-200">
                {beforeOfferChecks.map((check) => (
                  <li key={check} className="flex gap-2">
                    <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{check}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {showBreakdown ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-neutral-500">
          Version {version ?? 'v1.0'} • Scores are indicative and only display factors backed by available data. Overall score may include legacy model weighting; visible factors show available evidence only.
        </div>
      ) : null}
    </div>
  );
}
