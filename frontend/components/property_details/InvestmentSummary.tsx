'use client';

import { useEffect, useMemo, useState } from 'react';
import { postAiSummary } from '@/lib/api';
import type { SummaryRequest, SummaryResponse } from '@/types/ai';
import { formatRoiDisplay, getRoiProxyValidationNote, normalizeProperty } from '@/lib/normalizeProperty';

type Props = {
  property: {
    title: string;
    location: string;
    price?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    yield_percent?: number | null;
    roi_percent?: number | null;
    description?: string | null;
    propertyType?: string | null;
    investmentType?: string | null;
  };
};

const numOrUndef = (v: unknown): number | undefined =>
  v === null || v === undefined || v === '' ? undefined : Number(v as number);

const compactText = (value: unknown, maxLength = 150): string => {
  if (typeof value !== 'string') return '';
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const slice = clean.slice(0, maxLength - 1);
  const boundary = slice.lastIndexOf(' ');
  return `${slice.slice(0, boundary > 70 ? boundary : slice.length).trim()}…`;
};

export default function InvestmentSummary({ property }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState<SummaryResponse | null>(null);

  const { title, location, price, bedrooms, bathrooms, propertyType, investmentType, description } = property;

  const normalized = useMemo(() => normalizeProperty(property as any), [property]);
  const roiDisplay = useMemo(
    () => ({ value: normalized.roiPct, isProxy: normalized.roiIsProxy }),
    [normalized.roiIsProxy, normalized.roiPct],
  );
  const roiValidationNote = getRoiProxyValidationNote(roiDisplay);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(false);
      try {
        const payload: SummaryRequest = {
          title,
          location: String(location ?? ''),
          price: numOrUndef(price), // ✅ narrowed
          bedrooms: numOrUndef(bedrooms), // ✅ narrowed
          bathrooms: numOrUndef(bathrooms), // ✅ narrowed
          yield_percent: normalized.yieldPct ?? undefined,
          roi_percent: roiValidationNote ? undefined : (normalized.roiPct ?? undefined),
          propertyType: propertyType ?? undefined,
          investmentType: investmentType ?? undefined,
          description: description ?? undefined,
        };

        const res = await postAiSummary(payload);
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [
    title,
    location,
    price,
    bedrooms,
    bathrooms,
    propertyType,
    investmentType,
    description,
    normalized.yieldPct,
    normalized.roiPct,
    roiValidationNote,
  ]);

  if (loading)
    return (
      <div
        data-testid="investment-summary-loading"
        className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-400"
      >
        Loading short analyst note…
      </div>
    );

  if (error) return null;

  if (!data) return null;

  const summary = compactText(data.summary, 170);
  const bullets = Array.isArray(data.bullets)
    ? data.bullets.map((b) => compactText(b, 90)).filter(Boolean).slice(0, 2)
    : [];

  if (!summary && bullets.length === 0) return null;

  return (
    <div
      data-testid="investment-summary-text"
      className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/30"
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        Short analyst note
      </div>
      {roiValidationNote ? (
        <div className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
          ROI proxy: {formatRoiDisplay(roiDisplay)}. {roiValidationNote}
        </div>
      ) : null}
      {summary && (
        <p className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{summary}</p>
      )}

      {bullets.length > 0 && (
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
