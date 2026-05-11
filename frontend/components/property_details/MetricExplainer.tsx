'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { FiInfo } from 'react-icons/fi';

type Metric = 'gross_yield' | 'roi_proxy' | 'price_to_rent' | 'ai_score' | 'top_deal_score';

type Props = {
  metric: Metric;
  property?: Record<string, any> | null;
};

function money(value: unknown): string | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(n);
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getRent(property?: Record<string, any> | null): number | null {
  const candidates = [
    property?.rent_monthly,
    property?.monthly_rent,
    property?.rent_pcm,
    property?.rent_per_month,
    property?.rent,
    property?.avg_rent,
  ];
  for (const value of candidates) {
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function getPrice(property?: Record<string, any> | null): number | null {
  const n = typeof property?.price === 'number' ? property.price : Number(property?.price);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildContent(metric: Metric, property?: Record<string, any> | null) {
  const price = getPrice(property);
  const rent = getRent(property);
  const annualRent = rent ? rent * 12 : null;

  if (metric === 'gross_yield') {
    const example = price && rent ? `${money(rent)} × 12 ÷ ${money(price)} = ${pct((rent * 12 * 100) / price)}` : null;
    return {
      title: 'Gross yield',
      definition: 'Estimated yearly rent divided by asking price.',
      formula: 'Monthly rent × 12 ÷ asking price × 100',
      example,
      caution: 'Gross yield does not include mortgage, tax, service charge, repairs or void periods.',
    };
  }
  if (metric === 'roi_proxy') {
    return {
      title: 'ROI proxy',
      definition: 'A rough return estimate based on available price, rent and cost assumptions.',
      formula: 'Estimated annual return ÷ estimated cash invested × 100',
      example: null,
      caution: 'This is not verified profit. Validate finance, refurbishment, legal fees, tax and voids before relying on it.',
    };
  }
  if (metric === 'price_to_rent') {
    const example = price && annualRent ? `${money(price)} ÷ ${money(annualRent)} = ${(price / annualRent).toFixed(1)}×` : null;
    return {
      title: 'Price-to-rent',
      definition: 'Asking price divided by estimated annual rent.',
      formula: 'Asking price ÷ annual rent',
      example,
      caution: 'Lower can be better for cashflow. Higher can mean the rent is weak compared with the price.',
    };
  }
  if (metric === 'ai_score') {
    return {
      title: 'AI Deal Score',
      definition: 'Analysis score for the property based on available investor metrics and evidence.',
      formula: null,
      example: null,
      caution: 'This is not the scrape ranking score. Use it for due diligence, not as a guarantee.',
    };
  }
  return {
    title: 'Top Deal Score',
    definition: 'Discovery score used to decide whether PropNexus should surface the listing.',
    formula: null,
    example: null,
    caution: 'It checks signals like reductions, comps, rent evidence, value-add wording and data quality.',
  };
}

export default function MetricExplainer({ metric, property }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const content = useMemo(() => buildContent(metric, property), [metric, property]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex items-center align-middle">
      <button
        type="button"
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        aria-label={`Explain ${content.title}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
      >
        <FiInfo className="h-3 w-3" aria-hidden="true" />
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-6 z-50 w-72 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs font-normal normal-case tracking-normal text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          <span className="block text-sm font-bold text-slate-950 dark:text-white">{content.title}</span>
          <span className="mt-1 block leading-relaxed">{content.definition}</span>
          {content.formula ? <span className="mt-2 block rounded-lg bg-slate-50 px-2 py-1 font-semibold dark:bg-slate-900">{content.formula}</span> : null}
          {content.example ? <span className="mt-1 block text-slate-500 dark:text-slate-400">Example: {content.example}</span> : null}
          <span className="mt-2 block text-amber-700 dark:text-amber-300">{content.caution}</span>
        </span>
      ) : null}
    </span>
  );
}
