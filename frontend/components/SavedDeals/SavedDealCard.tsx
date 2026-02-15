'use client';

import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import type { SavedDeal } from './types';
import { normalizeProperty } from '@/lib/normalizeProperty';

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
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return '—';
  return `${v.toFixed(1)}%`;
}

function fmtDate(s?: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-GB');
  } catch {
    return '—';
  }
}

export default function SavedDealCard({
  deal,
  selected,
  disabled,
  onToggle,
  onRemove,
  removing,
}: {
  deal: SavedDeal;
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onRemove: () => void;
  removing?: boolean;
}) {
  const norm = normalizeProperty(deal as any);
  const href = deal.property_id ? `/property/${encodeURIComponent(deal.property_id)}` : '#';
  const imageSrc = deal.imageurl || 'https://placehold.co/640x360?text=PropNexus';

  return (
    <article
      className={clsx(
        'card p-0 overflow-hidden transition hover:shadow-md',
        selected && 'ring-2 ring-brand-500/20 border-brand-500/30',
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <Image
          src={imageSrc}
          alt={deal.title ?? 'Saved deal'}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover"
        />
        <label
          className={clsx(
            'absolute top-2 left-2 z-10 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold',
            'bg-white/90 dark:bg-slate-900/70 backdrop-blur border border-white/60 dark:border-slate-800',
            disabled && 'opacity-60 cursor-not-allowed',
          )}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            disabled={disabled}
            className="h-4 w-4"
            aria-label={selected ? 'Remove from comparison' : 'Select for comparison'}
          />
          Compare
        </label>
      </div>

      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <Link href={href} className="block font-semibold hover:underline leading-snug">
            {deal.title ?? '—'}
          </Link>
          {deal.investment_type ? (
            <span className="shrink-0 text-[11px] px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 tracking-wide">
              {String(deal.investment_type).toUpperCase()}
            </span>
          ) : null}
        </div>

        <div className="text-sm text-slate-600 dark:text-slate-300">{deal.location ?? '—'}</div>

        <div className="flex items-center justify-between pt-1">
          <div className="font-semibold text-slate-900 dark:text-white">{fmtGBP(norm.price ?? deal.price)}</div>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              Yield {fmtPct(norm.yieldPercent ?? deal.yield_percent)}
            </span>
            <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
              ROI{norm.roiIsProxy ? ' (proxy)' : ''} {fmtPct(norm.roiPercent ?? deal.roi_percent)}
            </span>
          </div>
        </div>

        <div className="text-xs text-slate-600 dark:text-slate-400">
          {(deal.bedrooms ?? 0) || '—'} beds • {(deal.bathrooms ?? 0) || '—'} baths
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400">Saved {fmtDate(deal.saved_at ?? deal.created_at)}</div>

        <div className="pt-2 grid grid-cols-2 gap-2">
          <Link href={href} className="pnx-pnx-btn pnx-pnx-pnx-btn-outline text-center">
            View
          </Link>
          <button
            type="button"
            className="pnx-pnx-btn pnx-pnx-pnx-btn-outline border-red-300 text-red-700 dark:border-red-800 dark:text-red-300"
            onClick={onRemove}
            disabled={Boolean(removing)}
            aria-busy={Boolean(removing)}
            aria-label="Remove saved deal"
          >
            {removing ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </article>
  );
}
