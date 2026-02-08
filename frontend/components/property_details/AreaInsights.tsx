'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiBarChart2 } from 'react-icons/fi';

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

const UI_TEXT = {
  title: 'Area Insights',
  subtitle: 'Intel + Comps',
  emptyIntel: 'No area intel available for this postcode yet.',
  emptyComps: 'No comps available for this postcode yet.',
  missingPostcode: 'Postcode not detected — insights unavailable.',
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
    <div className="animate-pulse space-y-2">
      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded" />
      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-4/6" />
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

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 rounded-full border ' +
        'border-slate-200 dark:border-slate-800 ' +
        'bg-white/60 dark:bg-slate-900/20 ' +
        'px-2 py-1 text-[12px] hover:border-slate-300 dark:hover:border-slate-700'
      }
    >
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <span className="font-semibold text-slate-900 dark:text-slate-100">{value}</span>
    </span>
  );
}

function countCaption(salesCount: number, rentsCount: number): string {
  const parts: string[] = [];
  if (salesCount > 0) parts.push(`${salesCount} sale${salesCount === 1 ? '' : 's'}`);
  if (rentsCount > 0) parts.push(`${rentsCount} rental${rentsCount === 1 ? '' : 's'}`);
  return parts.join(' • ');
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
  const gridCols = showIntel && showComps ? 'md:grid-cols-2' : 'md:grid-cols-1';

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

  if (!hasAny) return null;

  const sales = Array.isArray(comps?.sales) ? comps!.sales! : [];
  const rents = Array.isArray(comps?.rents) ? comps!.rents! : [];

  const usableIntel = !!intel;
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

  if (!pc) {
    return (
      <CollapsibleCard
        title={UI_TEXT.title}
        subtitle={UI_TEXT.subtitle}
        icon={icon}
        headerRight={headerRight}
        defaultExpanded={defaultExpanded}
      >
        <div className="text-sm text-slate-700 dark:text-slate-300">{UI_TEXT.missingPostcode}</div>
      </CollapsibleCard>
    );
  }

  return (
    <CollapsibleCard
      title={UI_TEXT.title}
      subtitle={UI_TEXT.subtitle}
      icon={icon}
      headerRight={headerRight}
      defaultExpanded={defaultExpanded}
    >
      <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
        {showIntel ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/20 p-4">
            <GatedPanel title="Area Intelligence" requiredPlan="pro" featureEnabled={showIntel}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Intel
                  </div>
                </div>

                {intelLoading ? (
                  <SkeletonLines />
                ) : intel ? (
                  (() => {
                    const chips: Array<{ label: string; value: string }> = [];

                    if (Number.isFinite(intel.avg_rent) && intel.avg_rent > 0) {
                      chips.push({ label: 'Rent/mo', value: fmtGBP(intel.avg_rent) });
                    }
                    if (Number.isFinite(intel.rental_yield_percent) && intel.rental_yield_percent > 0) {
                      chips.push({ label: 'Yield', value: `${intel.rental_yield_percent.toFixed(1)}%` });
                    }
                    if (Number.isFinite(intel.avg_price) && intel.avg_price > 0) {
                      chips.push({ label: 'Avg price', value: fmtGBP(intel.avg_price) });
                    }
                    if (Number.isFinite(intel.crime_index) && intel.crime_index > 0) {
                      chips.push({ label: 'Crime', value: `${Math.round(intel.crime_index)}/100` });
                    }
                    if (Number.isFinite(intel.schools_rating) && intel.schools_rating > 0) {
                      chips.push({ label: 'Schools', value: `${intel.schools_rating.toFixed(1)}/5` });
                    }

                    const shown = chips.slice(0, 5);

                    if (shown.length === 0) {
                      return (
                        <div className="text-xs text-slate-600 dark:text-slate-400">{UI_TEXT.emptyIntel}</div>
                      );
                    }

                    const sourceHint =
                      vLabel && rentSrc
                        ? rentSrc === 'proxy'
                          ? `Source: proxy rent estimate • ${vLabel}`
                          : `Source: live • ${vLabel}`
                        : undefined;

                    return (
                      <>
                        <div className="flex flex-wrap gap-2">{
                          shown.map((c) => (
                            <Chip key={c.label} label={c.label} value={c.value} />
                          ))
                        }</div>
                        {sourceHint ? (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">{sourceHint}</div>
                        ) : null}
                      </>
                    );
                  })()
                ) : (
                  <div className="text-xs text-slate-600 dark:text-slate-400">{UI_TEXT.emptyIntel}</div>
                )}
              </div>
            </GatedPanel>
          </div>
        ) : null}

        {showComps ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/20 p-4">
            <GatedPanel title="Comparable Sales" requiredPlan="pro" featureEnabled={showComps}>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Comps
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {countCaption(sales.length, rents.length)}
                  </div>
                </div>

                {compsLoading ? (
                  <SkeletonLines />
                ) : !usableComps ? (
                  <div className="text-xs text-slate-600 dark:text-slate-400">{UI_TEXT.emptyComps}</div>
                ) : (
                  <div className="space-y-2">
                    {[...sales.slice(0, 2).map((s) => ({ kind: 'sale' as const, line: s })),
                      ...rents.slice(0, 2).map((r) => ({ kind: 'rent' as const, line: r }))]
                      .slice(0, 4)
                      .map(({ kind, line }, idx) => (
                        <div
                          key={`${kind}-${idx}`}
                          className="flex justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/20 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-800 dark:text-slate-200 overflow-hidden text-ellipsis whitespace-nowrap">
                              {line.address}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              {line.date}
                              {Number.isFinite(line.distance_km)
                                ? ` • ${line.distance_km.toFixed(2)} km`
                                : ''}
                            </div>
                          </div>
                          <div className="min-w-[92px] text-right text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {Number.isFinite(line.price) && line.price > 0 ? fmtGBP(line.price) : '—'}
                            {kind === 'rent' ? <span className="text-slate-500">/mo</span> : null}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </GatedPanel>
          </div>
        ) : null}
      </div>
    </CollapsibleCard>
  );
}
