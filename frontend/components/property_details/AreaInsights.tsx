'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiBarChart2 } from 'react-icons/fi';

import CollapsibleCard from '@/components/property_details/CollapsibleCard';
import GatedPanel from '@/components/property_details/GatedPanel';
import { getAreaIntel, getComps } from '@/lib/api';
import { FF } from '@/lib/flags';

type AreaIntelData = {
  key?: string;
  avg_price?: number | null;
  avg_rent?: number | null;
  rental_yield_percent?: number | null;
  crime_index?: number | null;
  schools_rating?: number | null;
  count?: number;
  match_level?: 'postcode' | 'outward' | 'none';
  median_price?: number | null;
  median_rent?: number | null;
  median_yield_percent?: number | null;
  notes?: string;
  source?: 'db';
};

type CompsData = {
  postcode: string;
  source?: 'db';
  match_level?: 'postcode' | 'outward' | 'none';
  count?: number;
  median_price?: number | null;
  median_rent?: number | null;
};

type Status = 'db' | 'missing';

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
    status === 'db'
      ? {
          label: 'DB',
          dot: 'bg-emerald-500',
          cls:
            'border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-200',
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

  const compsCount = typeof comps?.count === 'number' ? comps.count : 0;
  const usableIntel = !!intel;
  const usableComps =
    !!comps &&
    (compsCount > 0 ||
      (typeof comps.median_price === 'number' && comps.median_price > 0) ||
      (typeof comps.median_rent === 'number' && comps.median_rent > 0));

  const status: Status = (() => {
    if (!pc) return 'missing';
    if (!usableIntel && !usableComps && !intelLoading && !compsLoading) return 'missing';
    return 'db';
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
      <div className="space-y-4">
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
                      vLabel ? `Source: db • ${vLabel}` : 'Source: db';

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
                    Comparable Sales
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {compsCount > 0 ? `${compsCount} sample${compsCount === 1 ? '' : 's'}` : ''}
                    {comps?.match_level ? ` • ${comps.match_level}` : ''}
                  </div>
                </div>

                {compsLoading ? (
                  <SkeletonLines />
                ) : comps && (typeof comps.median_price === 'number' || typeof comps.median_rent === 'number') ? (
                  <div className="flex flex-wrap gap-2">
                    <Chip label="Median price" value={fmtGBP(comps.median_price)} />
                    <Chip label="Median rent/mo" value={fmtGBP(comps.median_rent)} />
                    <Chip label="Samples" value={String(compsCount)} />
                    {comps.match_level ? <Chip label="Match" value={comps.match_level} /> : null}
                  </div>
                ) : (
                  <div className="text-xs text-slate-600 dark:text-slate-400">{UI_TEXT.emptyComps}</div>
                )}
              </div>
            </GatedPanel>
          </div>
        ) : null}
      </div>
    </CollapsibleCard>
  );
}
