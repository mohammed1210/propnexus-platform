'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { FiBarChart2, FiBookOpen, FiHome, FiMapPin, FiShield } from 'react-icons/fi';

import CollapsibleCard from '@/components/property_details/CollapsibleCard';
import GatedPanel from '@/components/property_details/GatedPanel';
import { getAreaIntel, getComps } from '@/lib/api';
import { FF } from '@/lib/flags';

type AreaIntelData = {
  key: string;
  population: number;
  avg_price: number;
  avg_rent: number;
  rental_yield_percent: number;
  crime_index: number;
  schools_rating: number;
  notes?: string;
  source?: 'provider' | 'cache';
};

type CompLine = {
  address: string;
  price: number;
  date: string;
  type: string;
  distance_km: number;
};

type CompsData = {
  postcode: string;
  sales?: CompLine[];
  rents?: CompLine[];
  source?: 'provider' | 'cache';
};

type Status = 'live' | 'proxy' | 'missing';

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
      : status === 'proxy'
        ? {
            label: 'Proxy',
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

function toneClasses(tone: MetricTone): string {
  if (tone === 'brand') return 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900/60 dark:bg-brand-950/30 dark:text-brand-300';
  if (tone === 'emerald') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300';
  if (tone === 'amber') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300';
  if (tone === 'rose') return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300';
  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300';
}

function MarketMetricCard({ label, value, helper, tone, icon }: MarketMetric) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {label}
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{value}</div>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneClasses(tone)}`}>
          {icon}
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{helper}</p>
    </div>
  );
}

function SignalBar({ label, value, max, lowerIsBetter = false }: { label: string; value?: number; max: number; lowerIsBetter?: boolean }) {
  const safeValue = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : undefined;
  const pct = safeValue === undefined ? 0 : (safeValue / max) * 100;
  const good = safeValue === undefined ? false : lowerIsBetter ? safeValue <= max * 0.4 : safeValue >= max * 0.7;
  const mid = safeValue === undefined ? false : lowerIsBetter ? safeValue <= max * 0.7 : safeValue >= max * 0.45;
  const bar = good ? 'bg-emerald-500' : mid ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/30">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
        <span className="font-semibold text-slate-950 dark:text-white">
          {safeValue === undefined ? '—' : max === 5 ? `${safeValue.toFixed(1)}/5` : `${Math.round(safeValue)}/100`}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {lowerIsBetter ? 'Lower is generally more attractive for tenant demand.' : 'Higher indicates stronger local support for the deal.'}
      </p>
    </div>
  );
}

function avgPrice(lines: CompLine[]): number | null {
  const valid = lines.filter((line) => Number.isFinite(line.price) && line.price > 0);
  if (valid.length === 0) return null;
  return valid.reduce((sum, line) => sum + line.price, 0) / valid.length;
}

function fmtDistance(km: unknown): string {
  const v = typeof km === 'number' ? km : Number(km);
  return Number.isFinite(v) ? `${v.toFixed(2)} km` : '—';
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

  const pc = normStr(postcode);
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
  const marketMetrics = useMemo(() => {
    if (!intel) return [] as MarketMetric[];

    return [
      {
        label: 'Avg price',
        value: fmtGBP(intel.avg_price),
        helper: 'Typical local sale value benchmark',
        tone: 'brand' as const,
        icon: <FiHome className="h-5 w-5" />,
      },
      {
        label: 'Rent / month',
        value: fmtGBP(intel.avg_rent),
        helper: rentSrc === 'proxy' ? 'Proxy rent estimate' : 'Local monthly rent benchmark',
        tone: rentSrc === 'proxy' ? ('amber' as const) : ('emerald' as const),
        icon: <FiBarChart2 className="h-5 w-5" />,
      },
      {
        label: 'Rental yield',
        value:
          Number.isFinite(intel.rental_yield_percent) && intel.rental_yield_percent > 0
            ? `${intel.rental_yield_percent.toFixed(1)}%`
            : '—',
        helper: 'Area-level gross yield signal',
        tone: 'emerald' as const,
        icon: <FiMapPin className="h-5 w-5" />,
      },
      {
        label: 'Population',
        value:
          Number.isFinite(intel.population) && intel.population > 0
            ? Math.round(intel.population).toLocaleString('en-GB')
            : '—',
        helper: 'Local demand depth indicator',
        tone: 'slate' as const,
        icon: <FiBookOpen className="h-5 w-5" />,
      },
    ];
  }, [intel, rentSrc]);

  const usableIntel = marketMetrics.length > 0;
  const usableComps = sales.length > 0 || rents.length > 0;

  const status: Status = (() => {
    if (!pc) return 'missing';
    if (rentSrc === 'missing') return 'missing';
    if (!usableIntel && !usableComps && !intelLoading && !compsLoading) return 'missing';
    if (rentSrc === 'proxy') return 'proxy';
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
      <div className="space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
          <div className="border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-brand-50/40 p-5 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-brand-950/20">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Local market intelligence
                </div>
                <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  Demand, yield and comparable evidence
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Read the area like an investor: local rent benchmarks, demand signals and nearby transactions in one place.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                {pc ? (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                    {pc.toUpperCase()}
                  </span>
                ) : null}
                {vLabel && rentSrc ? (
                  <span>
                    {rentSrc === 'proxy' ? `Proxy rent • ${vLabel}` : `Live source • ${vLabel}`}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5">
        {showIntel && (intelLoading || usableIntel) ? (
          <div>
            <GatedPanel title="Area Intelligence" requiredPlan="pro" featureEnabled={showIntel}>
              <div className="space-y-5">
                {intelLoading ? (
                  <SkeletonLines />
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {marketMetrics.map((metric) => (
                        <MarketMetricCard key={metric.label} {...metric} />
                      ))}
                    </div>

                    {intel ? (
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <SignalBar label="Crime index" value={intel.crime_index} max={100} lowerIsBetter />
                        <SignalBar label="Schools rating" value={intel.schools_rating} max={5} />
                      </div>
                    ) : null}

                    {intel?.notes ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          Local read
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{intel.notes}</p>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </GatedPanel>
          </div>
        ) : null}

        {showComps && (compsLoading || usableComps) ? (
          <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
            <GatedPanel title="Comparable Sales" requiredPlan="pro" featureEnabled={showComps}>
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Comparable evidence
                    </div>
                    <h4 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                      Recent nearby transactions
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:min-w-72">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Avg sale comp</div>
                      <div className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{fmtGBP(avgSalePrice)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Avg rent comp</div>
                      <div className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{fmtGBP(avgRentPrice)}</div>
                    </div>
                  </div>
                </div>

                {compsLoading ? (
                  <SkeletonLines />
                ) : sales.length > 0 ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {sales.slice(0, 6).map((line, idx) => (
                      <article
                        key={`sale-${idx}`}
                        className="rounded-2xl border border-slate-200 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-950 dark:text-white">
                              {fmtGBP(line.price)}
                            </div>
                            <div className="mt-1 truncate text-sm text-slate-700 dark:text-slate-300">{line.address}</div>
                          </div>
                          <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            {fmtDistance(line.distance_km)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>{line.date || 'Date unavailable'}</span>
                          {line.type ? <span>• {line.type}</span> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}

                {rents.length > 0 ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                          Rental comps
                        </div>
                        <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {rents.length} rental comparable{rents.length === 1 ? '' : 's'} available for this postcode.
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
