'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { FiBarChart2, FiHome, FiMapPin, FiShield } from 'react-icons/fi';

import CollapsibleCard from '@/components/property_details/CollapsibleCard';
import GatedPanel from '@/components/property_details/GatedPanel';
import { getAreaIntel, getComps } from '@/lib/api';
import { FF } from '@/lib/flags';

type AreaIntelData = {
  key: string;
  postcode?: string;
  avg_price?: number | null;
  avg_rent?: number | null;
  rental_yield_percent?: number | null;
  crime_index?: number | null;
  crime_index_source?: string | null;
  crime?: {
    count?: number | null;
    month?: string | null;
    period?: string | null;
    source?: string | null;
    signal?: 'low' | 'moderate' | 'elevated' | null;
    radius_label?: string | null;
    note?: string | null;
  } | null;
  crime_source?: 'police.uk' | 'unavailable' | string | null;
  crime_period?: string | null;
  crime_count?: number | null;
  crime_signal?: 'low' | 'moderate' | 'elevated' | string | null;
  crime_radius_label?: string | null;
  crime_note?: string | null;
  rent_source?: string | null;
  rent_evidence_count?: number | null;
  rent_estimate_count?: number | null;
  schools_rating?: number | null;
  population?: number | null;
  transport_links?: string[];
  notes?: string;
  source?: string;
  source_details?: Record<string, unknown>;
  confidence?: string;
  fetched_at?: string;
  is_live?: boolean;
  is_proxy?: boolean;
};

type CompLine = {
  address: string;
  price: number;
  rent_monthly?: number;
  date?: string;
  type?: string;
  property_type?: string;
  tenure?: string;
  distance_km?: number | null;
  source?: string;
};

type CompsData = {
  postcode: string;
  sales?: CompLine[];
  rents?: CompLine[];
  source?: string;
  source_details?: Record<string, unknown>;
  fetched_at?: string;
};

type Status = 'live' | 'partial' | 'derived' | 'cached' | 'missing';

type MetricTone = 'brand' | 'emerald' | 'amber' | 'rose' | 'slate';

type MarketMetric = {
  label: string;
  value: string;
  helper: string;
  tone: MetricTone;
  icon: ReactNode;
};

const UI_TEXT = {
  title: 'Area Insights',
  subtitle: 'Intel + Comps',
} as const;

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

function fmtVersion(v: unknown): string | undefined {
  const s = normStr(v);
  if (!s) return undefined;
  return s.startsWith('v') || s.startsWith('V') ? s : `v${s}`;
}

function fmtGBP(n: unknown): string {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return '—';
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `£${Math.round(v).toLocaleString('en-GB')}`;
  }
}

function SkeletonLines() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((idx) => (
          <div key={idx} className="h-28 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
        ))}
      </div>
      <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const cfg =
    status === 'live'
      ? {
          label: 'Live',
          dot: 'bg-emerald-500',
          cls:
            'border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-200',
        }
      : status === 'cached'
        ? {
            label: 'Cached',
            dot: 'bg-sky-500',
            cls:
              'border-sky-200/80 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-900/20 dark:text-sky-200',
          }
        : status === 'partial'
          ? {
              label: 'Partial',
              dot: 'bg-brand-500',
              cls:
                'border-brand-200/80 bg-brand-50 text-brand-800 dark:border-brand-900/50 dark:bg-brand-900/20 dark:text-brand-200',
            }
          : status === 'derived'
        ? {
            label: 'Derived',
            dot: 'bg-amber-500',
            cls:
              'border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200',
          }
        : {
            label: 'Missing',
            dot: 'bg-slate-400',
            cls:
              'border-slate-200/80 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/20 dark:text-slate-200',
          };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.cls}`}
      aria-label={`Area insights status: ${cfg.label}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function SourceBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
      {label}
    </span>
  );
}

function toneClasses(tone: MetricTone): string {
  if (tone === 'brand') return 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900/60 dark:bg-brand-950/30 dark:text-brand-300';
  if (tone === 'emerald') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300';
  if (tone === 'amber') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300';
  if (tone === 'rose') return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300';
  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300';
}

function MarketMetricCard({ label, value, helper, tone, icon }: MarketMetric) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {label}
          </div>
          <div className="mt-1.5 text-xl font-bold tracking-tight text-slate-950 dark:text-white">{value}</div>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${toneClasses(tone)}`}>
          {icon}
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{helper}</p>
    </div>
  );
}

function avgPrice(lines: CompLine[]): number | null {
  const valid = lines.filter((line) => Number.isFinite(line.price) && line.price > 0);
  if (valid.length === 0) return null;
  return valid.reduce((sum, line) => sum + line.price, 0) / valid.length;
}

function hasPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sourceLabel(source?: string | null): string | null {
  if (!source) return null;
  if (source === 'not_available') return null;
  const map: Record<string, string> = {
    land_registry_ppd: 'Land Registry PPD',
    internal_property_listings: 'Internal listing comps',
    derived_internal_estimate: 'Derived rent estimate',
    ons_local_area: 'Area rent benchmark',
    police: 'police.uk',
    'police.uk': 'police.uk',
    cache: 'Cached',
    partial_live: 'Partial live',
  };
  return map[source] ?? source.replace(/_/g, ' ');
}

function sourceDetail(details: Record<string, unknown> | undefined, key: string): string | null {
  const value = details?.[key];
  return typeof value === 'string' ? value : null;
}

function rentMetricCopy(source?: string | null): { label: string; helper: string; badge: string | null } | null {
  if (source === 'internal_property_listings') {
    return {
      label: 'Rent evidence',
      helper: 'Average from real internal rental listing evidence',
      badge: 'Internal rental listings',
    };
  }
  if (source === 'derived_internal_estimate') {
    return {
      label: 'Derived rent estimate',
      helper: 'Derived internal estimate; not a rental comp',
      badge: 'Derived estimate',
    };
  }
  if (source === 'ons_local_area') {
    return {
      label: 'Area rent benchmark',
      helper: 'Broad official local-area benchmark',
      badge: 'Area benchmark',
    };
  }
  return null;
}

function crimeSignalCopy(signal?: string | null): string {
  if (signal === 'low') return 'Low';
  if (signal === 'moderate') return 'Moderate';
  if (signal === 'elevated') return 'Elevated';
  return 'Reported nearby crime';
}

function fmtDistance(km: unknown): string {
  const v = typeof km === 'number' ? km : Number(km);
  return Number.isFinite(v) ? `${v.toFixed(2)} km` : '—';
}

function hasMeaningfulDistance(km: unknown): km is number {
  const v = typeof km === 'number' ? km : Number(km);
  return Number.isFinite(v) && v > 0;
}

export default function AreaInsights({
  areaKey,
  postcode,
  rentSource,
  version,
  defaultExpanded = false,
}: {
  areaKey: string;
  postcode: string;
  rentSource?: string;
  version?: string;
  defaultExpanded?: boolean;
}) {
  const showIntel = FF.AREA_INTEL;
  const showComps = FF.COMPS;

  const hasAny = showIntel || showComps;

  const icon = useMemo(
    () => (
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
        <FiBarChart2 className="w-5 h-5 text-white" />
      </div>
    ),
    [],
  );

  const pc = normStr(postcode) || extractUkPostcode(areaKey);
  const rentSrc = normStr(rentSource).toLowerCase();
  const vLabel = fmtVersion(version);

  const [intelLoading, setIntelLoading] = useState<boolean>(showIntel);
  const [compsLoading, setCompsLoading] = useState<boolean>(showComps);
  const [intel, setIntel] = useState<AreaIntelData | null>(null);
  const [comps, setComps] = useState<CompsData | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!hasAny) {
      setIntelLoading(false);
      setCompsLoading(false);
      setIntel(null);
      setComps(null);
      return () => {
        cancelled = true;
      };
    }

    if (!pc) {
      setIntelLoading(false);
      setCompsLoading(false);
      setIntel(null);
      setComps(null);
      return;
    }

    if (showIntel) {
      (async () => {
        setIntelLoading(true);
        try {
          const res = (await getAreaIntel(areaKey)) as AreaIntelData;
          if (!cancelled) setIntel(res ?? null);
        } catch {
          if (!cancelled) setIntel(null);
        } finally {
          if (!cancelled) setIntelLoading(false);
        }
      })();
    } else {
      setIntelLoading(false);
      setIntel(null);
    }

    if (showComps) {
      (async () => {
        setCompsLoading(true);
        try {
          const res = (await getComps(pc)) as CompsData;
          if (!cancelled) setComps(res ?? null);
        } catch {
          if (!cancelled) setComps(null);
        } finally {
          if (!cancelled) setCompsLoading(false);
        }
      })();
    } else {
      setCompsLoading(false);
      setComps(null);
    }

    return () => {
      cancelled = true;
    };
  }, [pc, showIntel, showComps, areaKey, hasAny]);

  const sales = Array.isArray(comps?.sales) ? comps!.sales! : [];
  const rents = Array.isArray(comps?.rents) ? comps!.rents! : [];
  const avgSalePrice = avgPrice(sales);
  const avgRentPrice = avgPrice(rents);
  const crimeCount = hasFiniteNumber(intel?.crime_count)
    ? intel!.crime_count!
    : hasFiniteNumber(intel?.crime?.count)
      ? intel!.crime!.count!
      : null;
  const hasCrime = (intel?.crime_source === 'police.uk' || intel?.crime?.source === 'police.uk') && hasFiniteNumber(crimeCount);
  const rentSourceForMetric = normStr(intel?.rent_source) || sourceDetail(intel?.source_details, 'rent');
  const rentCopy = rentMetricCopy(rentSourceForMetric);

  const marketMetrics = useMemo(() => {
    const metrics: MarketMetric[] = [];
    const soldBenchmark = hasPositiveNumber(intel?.avg_price) ? intel!.avg_price! : avgSalePrice;
    if (hasPositiveNumber(soldBenchmark)) {
      metrics.push({
        label: 'Sold-price benchmark',
        value: fmtGBP(soldBenchmark),
        helper: 'Based on available Land Registry sold-price records',
        tone: 'brand' as const,
        icon: <FiHome className="h-5 w-5" />,
      });
    }
    if (hasPositiveNumber(intel?.avg_rent)) {
      const copy = rentMetricCopy(normStr(intel.rent_source) || sourceDetail(intel.source_details, 'rent'));
      if (!copy) return metrics;
      metrics.push({
        label: copy.label,
        value: fmtGBP(intel.avg_rent),
        helper: copy.helper,
        tone: 'amber' as const,
        icon: <FiBarChart2 className="h-5 w-5" />,
      });
    }
    if (rentCopy && hasPositiveNumber(intel?.rental_yield_percent)) {
      metrics.push({
        label: 'Rental yield',
        value: `${intel.rental_yield_percent.toFixed(1)}%`,
        helper: `Derived from sold-price benchmark and ${rentCopy.label.toLowerCase()}`,
        tone: 'emerald' as const,
        icon: <FiMapPin className="h-5 w-5" />,
      });
    }
    const count = hasFiniteNumber(intel?.crime_count)
      ? intel.crime_count
      : hasFiniteNumber(intel?.crime?.count)
        ? intel.crime.count
        : null;
    if ((intel?.crime_source === 'police.uk' || intel?.crime?.source === 'police.uk') && hasFiniteNumber(count)) {
      const signal = normStr(intel?.crime_signal) || normStr(intel?.crime?.signal);
      metrics.push({
        label: 'Reported crime signal',
        value: `${count} reports`,
        helper: `police.uk reported incident count; not a safety score. ${crimeSignalCopy(signal)}${intel?.crime_period || intel?.crime?.month ? ` • ${intel?.crime_period || intel?.crime?.month}` : ''}`,
        tone: signal === 'elevated' ? 'rose' : signal === 'moderate' ? 'amber' : 'emerald',
        icon: <FiShield className="h-5 w-5" />,
      });
    }
    return metrics;
  }, [avgSalePrice, intel, rentCopy]);

  const usableIntel = marketMetrics.length > 0;
  const usableComps = sales.length > 0 || rents.length > 0;
  const dataSourceBadges = [
    sourceLabel(sourceDetail(intel?.source_details, 'sales')) || (sales.length > 0 ? 'Land Registry PPD' : null),
    rentCopy?.badge,
    hasCrime ? 'police.uk' : null,
    comps?.source === 'cache' || intel?.source === 'cache' ? 'Cached' : null,
  ].filter((value): value is string => Boolean(value));

  const status: Status = (() => {
    if (!pc) return 'missing';
    if (rentSrc === 'missing') return 'missing';
    if (!usableIntel && !usableComps && !intelLoading && !compsLoading) return 'missing';
    if (intel?.source === 'cache' || comps?.source === 'cache') return 'cached';
    if (intel?.is_proxy || rentSrc === 'proxy') return 'derived';
    if (intel?.source === 'partial_live' || comps?.source === 'partial_live') return 'partial';
    return 'live';
  })();

  const headerRight = (
    <div className="flex items-center gap-2">
      <StatusPill status={status} />
    </div>
  );

  if (!hasAny) return null;
  if (!pc) return null;
  if (!intelLoading && !compsLoading && !usableIntel && !usableComps) return null;

  return (
    <CollapsibleCard
      title={UI_TEXT.title}
      subtitle={UI_TEXT.subtitle}
      icon={icon}
      headerRight={headerRight}
      defaultExpanded={defaultExpanded}
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
          <div className="border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-brand-50/40 p-4 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-brand-950/20 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Local market intelligence
                </div>
                <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-[1.35rem]">
                  Demand, yield and comparable evidence
                </h3>
                <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-slate-600 dark:text-slate-300 sm:text-sm">
                  Read the area like an investor: local rent benchmarks, demand signals and nearby transactions in one place.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
                {pc ? (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                    {pc.toUpperCase()}
                  </span>
                ) : null}
                {vLabel && rentSrc ? (
                  <span>{rentSrc === 'proxy' ? `Derived rent • ${vLabel}` : `Score version • ${vLabel}`}</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
        {showIntel && (intelLoading || usableIntel) ? (
          <div>
            <GatedPanel title="Area Intelligence" requiredPlan="pro" featureEnabled={showIntel}>
              <div className="space-y-4">
                {intelLoading ? (
                  <SkeletonLines />
                ) : (
                  <>
                    <div className={`grid grid-cols-1 gap-3 ${marketMetrics.length === 1 ? 'sm:max-w-sm' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
                      {marketMetrics.map((metric) => (
                        <MarketMetricCard key={metric.label} {...metric} />
                      ))}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/30">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                          Based on available Land Registry sold-price records. Rent, crime and other demand signals only appear when live evidence is available.
                        </p>
                        {dataSourceBadges.length > 0 ? (
                          <div className="flex shrink-0 flex-wrap gap-2">
                            {dataSourceBadges.map((badge) => <SourceBadge key={badge} label={badge} />)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </GatedPanel>
          </div>
        ) : null}

        {showComps && (compsLoading || usableComps) ? (
          <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
            <GatedPanel title="Comparable Sales" requiredPlan="pro" featureEnabled={showComps}>
              <div className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Comparable evidence
                    </div>
                    <h4 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                      Recent nearby transactions
                    </h4>
                  </div>
                  {hasPositiveNumber(avgSalePrice) || hasPositiveNumber(avgRentPrice) ? (
                    <div className="grid grid-cols-1 gap-3 sm:min-w-72 sm:grid-cols-2">
                      {hasPositiveNumber(avgSalePrice) ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/30 sm:p-3.5">
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">Avg sale comp</div>
                          <div className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{fmtGBP(avgSalePrice)}</div>
                        </div>
                      ) : null}
                      {hasPositiveNumber(avgRentPrice) ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/30 sm:p-3.5">
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">Avg rent comp</div>
                          <div className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{fmtGBP(avgRentPrice)}</div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {compsLoading ? (
                  <SkeletonLines />
                ) : sales.length > 0 ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {sales.slice(0, 6).map((line, idx) => (
                      <article
                        key={`sale-${idx}`}
                        className="rounded-2xl border border-slate-200 bg-white/90 p-3.5 dark:border-slate-800 dark:bg-slate-950/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-950 dark:text-white">
                              {fmtGBP(line.price)}
                            </div>
                            <div className="mt-1 truncate text-sm text-slate-700 dark:text-slate-300">{line.address}</div>
                          </div>
                          {hasMeaningfulDistance(line.distance_km) ? (
                            <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                              {fmtDistance(line.distance_km)}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          {line.date ? <span>{line.date}</span> : null}
                          {line.type || line.property_type ? <span>• {line.type || line.property_type}</span> : null}
                          {sourceLabel(line.source) ? <span>• {sourceLabel(line.source)}</span> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}

                {rents.length > 0 ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                          Rental comps
                        </div>
                        <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {rents.length} internal rental comparable{rents.length === 1 ? '' : 's'} available for this postcode.
                        </div>
                      </div>
                      <div className="text-lg font-bold text-slate-950 dark:text-white">{fmtGBP(avgRentPrice)}</div>
                    </div>
                  </div>
                ) : null}
              </div>
            </GatedPanel>
          </div>
        ) : null}
          </div>
        </div>
      </div>
    </CollapsibleCard>
  );
}
