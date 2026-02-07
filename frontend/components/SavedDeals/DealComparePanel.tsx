'use client';

import clsx from 'clsx';
import type { ComparableDeal } from './types';

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

function fmtPct(n: unknown): string {
  if (n == null) return '—';
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return '—';
  return `${v.toFixed(1)}%`;
}

function fmtInt(n: unknown): string {
  if (n == null) return '—';
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return '—';
  return String(Math.round(v));
}

function getRentInputs(d: ComparableDeal): {
  rentMonthly?: number;
  rentSource?: string;
} {
  const inputs = (d.score_breakdown as any)?.inputs;
  const rentMonthly = typeof inputs?.rent_monthly === 'number' ? inputs.rent_monthly : undefined;
  const rentSource = typeof inputs?.rent_source === 'string' ? inputs.rent_source : undefined;
  return { rentMonthly, rentSource };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function MiniBar({ value }: { value: number }) {
  const v = clamp(value, 0, 100);
  const tone =
    'bg-gradient-to-r from-red-500 via-amber-500 to-green-500 dark:from-red-400 dark:via-amber-400 dark:to-green-400';
  return (
    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
      <div className={clsx('h-2 rounded-full', tone)} style={{ width: `${v}%` }} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px,1fr] gap-3 items-start py-2 border-t border-slate-200 dark:border-slate-800">
      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(var(--cols), minmax(0, 1fr))` }}>
        {children}
      </div>
    </div>
  );
}

export default function DealComparePanel({
  deals,
  onClear,
}: {
  deals: ComparableDeal[];
  onClear?: () => void;
}) {
  const cols = deals.length;

  if (cols < 2) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Compare deals</div>
        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Select 2–4 saved deals to compare key metrics.
        </div>
      </div>
    );
  }

  const hasCategories = deals.some((d) => {
    const cats = (d.score_breakdown as any)?.categories;
    return cats && typeof cats === 'object' && Object.keys(cats).length > 0;
  });

  const categoryRows: Array<{ key: string; label: string }> = [
    { key: 'roi', label: 'ROI' },
    { key: 'yield', label: 'Yield' },
    { key: 'area_demand', label: 'Area demand' },
    { key: 'price_to_rent', label: 'Price-to-rent' },
    { key: 'schools', label: 'Schools' },
    { key: 'safety', label: 'Safety' },
  ];

  return (
    <div
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
      style={{ ['--cols' as any]: cols }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Deal comparison</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Side-by-side for {cols} deals</div>
        </div>
        {onClear ? (
          <button
            type="button"
            className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline"
            onClick={onClear}
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="mt-3">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {deals.map((d) => (
            <div key={d.id} className="px-2">
              <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {d.title ?? '—'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {d.postcode || d.location || '—'}
              </div>
            </div>
          ))}
        </div>

        <Row label="Price">
          {deals.map((d) => (
            <div key={d.id} className="px-2 text-sm font-semibold text-slate-900 dark:text-white">
              {fmtGBP(d.price)}
            </div>
          ))}
        </Row>

        <Row label="Beds / Baths">
          {deals.map((d) => (
            <div key={d.id} className="px-2 text-sm text-slate-700 dark:text-slate-200">
              {fmtInt(d.bedrooms)}/{fmtInt(d.bathrooms)}
            </div>
          ))}
        </Row>

        <Row label="Score">
          {deals.map((d) => (
            <div key={d.id} className="px-2 text-sm text-slate-700 dark:text-slate-200">
              {(() => {
                const raw = d.ai_score ?? d.score;
                if (raw == null) return '—';
                const v = typeof raw === 'number' ? raw : Number(raw);
                if (!Number.isFinite(v) || v <= 0) return '—';
                return (
                  <>
                    {Math.round(v)}<span className="text-slate-400">/100</span>
                  </>
                );
              })()}
            </div>
          ))}
        </Row>

        <Row label="Yield">
          {deals.map((d) => (
            <div key={d.id} className="px-2 text-sm text-slate-700 dark:text-slate-200">
              {fmtPct(d.yield_percent)}
            </div>
          ))}
        </Row>

        <Row label="ROI">
          {deals.map((d) => (
            <div key={d.id} className="px-2 text-sm text-slate-700 dark:text-slate-200">
              {fmtPct(d.roi_percent)}
            </div>
          ))}
        </Row>

        <Row label="Rent / mo">
          {deals.map((d) => {
            const { rentMonthly } = getRentInputs(d);
            return (
              <div key={d.id} className="px-2 text-sm text-slate-700 dark:text-slate-200">
                {typeof rentMonthly === 'number' && rentMonthly > 0
                  ? fmtGBP(rentMonthly)
                  : '—'}
              </div>
            );
          })}
        </Row>

        <Row label="Rent source">
          {deals.map((d) => {
            const { rentSource } = getRentInputs(d);
            const label = rentSource === 'proxy' ? 'Proxy' : rentSource ? 'Provided' : 'Missing';
            const tone =
              rentSource === 'proxy'
                ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-200'
                : rentSource
                  ? 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-200';

            return (
              <div key={d.id} className="px-2">
                <span className={clsx('inline-flex rounded-md px-2 py-1 text-xs font-semibold', tone)}>
                  {label}
                </span>
              </div>
            );
          })}
        </Row>

        {hasCategories ? (
          <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Score breakdown
            </div>
            <div className="mt-2 space-y-2">
              {categoryRows.map((row) => (
                <div key={row.key} className="grid grid-cols-[120px,1fr] gap-3 items-center">
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    {row.label}
                  </div>
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                  >
                    {deals.map((d) => {
                      const cats = (d.score_breakdown as any)?.categories ?? {};
                      const raw = cats[row.key];
                      const v = typeof raw === 'number' ? raw : NaN;
                      return (
                        <div key={d.id} className="px-2">
                          {Number.isFinite(v) ? <MiniBar value={v} /> : <div className="h-2" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
