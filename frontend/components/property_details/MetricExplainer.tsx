'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiInfo } from 'react-icons/fi';

type Metric = 'gross_yield' | 'roi_proxy' | 'price_to_rent' | 'ai_score' | 'top_deal_score';

type Props = {
  metric: Metric;
  property?: Record<string, any> | null;
  placement?: 'auto' | 'top' | 'bottom';
  compact?: boolean;
};

type TooltipPosition = {
  left: number;
  top: number;
  placement: 'top' | 'bottom';
  width: number;
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function MetricExplainer({ metric, property, placement = 'auto', compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const id = useId();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const content = useMemo(() => buildContent(metric, property), [metric, property]);

  const updatePosition = useCallback(() => {
    const trigger = buttonRef.current;
    if (!trigger || typeof window === 'undefined') return;

    const rect = trigger.getBoundingClientRect();
    const margin = 16;
    const gap = 8;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 320;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 640;
    const width = Math.min(compact ? 230 : 260, Math.max(160, viewportWidth - margin * 2));
    const estimatedHeight = compact ? 132 : 168;
    const canFitBelow = rect.bottom + gap + estimatedHeight <= viewportHeight - margin;
    const canFitAbove = rect.top - gap - estimatedHeight >= margin;
    const finalPlacement = placement === 'bottom'
      ? 'bottom'
      : placement === 'top'
        ? 'top'
        : canFitBelow || !canFitAbove
          ? 'bottom'
          : 'top';

    const left = clamp(rect.left + rect.width / 2 - width / 2, margin, viewportWidth - width - margin);
    const top = finalPlacement === 'bottom'
      ? Math.min(rect.bottom + gap, viewportHeight - estimatedHeight - margin)
      : Math.max(margin, rect.top - gap - estimatedHeight);

    setPosition({ left, top, placement: finalPlacement, width });
  }, [compact, placement]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !tooltipRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onUpdate = () => updatePosition();
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
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) setPosition(null);
  }, [open]);

  const tooltip = open && position && typeof document !== 'undefined'
    ? createPortal(
        <span
          ref={tooltipRef}
          id={id}
          role="tooltip"
          data-placement={position.placement}
          className="fixed z-[1000] rounded-lg border border-slate-200 bg-white p-2.5 text-left text-[11px] font-normal normal-case tracking-normal text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          style={{ left: position.left, top: position.top, width: position.width, maxWidth: 'calc(100vw - 32px)' }}
        >
          <span className="block text-xs font-bold text-slate-950 dark:text-white">{content.title}</span>
          <span className="mt-1 block leading-relaxed">{content.definition}</span>
          {content.formula ? <span className="mt-1.5 block rounded-md bg-slate-50 px-2 py-1 font-semibold dark:bg-slate-900">{content.formula}</span> : null}
          {content.example ? <span className="mt-1 block leading-relaxed text-slate-500 dark:text-slate-400">Example: {content.example}</span> : null}
          <span className="mt-1.5 block leading-relaxed text-amber-700 dark:text-amber-300">{content.caution}</span>
        </span>,
        document.body,
      )
    : null;

  return (
    <span ref={rootRef} className="inline-flex items-center align-middle">
      <button
        ref={buttonRef}
        type="button"
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        aria-label={`Explain ${content.title}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <FiInfo className="h-3 w-3" aria-hidden="true" />
      </button>
      {tooltip}
    </span>
  );
}
