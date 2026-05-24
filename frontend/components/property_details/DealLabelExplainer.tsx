'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiInfo, FiX } from 'react-icons/fi';
import { getDealLabelLegalCopy } from '@/lib/dealLabel';

type Props = {
  compact?: boolean;
  className?: string;
};

const labels = [
  { name: 'Prime Deal', copy: 'High score, usable confidence and a strong value signal such as a meaningful discount or strong yield.' },
  { name: 'Strong Deal', copy: 'Good evidence-backed score with at least one strong value signal, but still needs normal diligence.' },
  { name: 'Fair Deal', copy: 'Some evidence supports the case, but the edge is not strong enough for a premium label.' },
  { name: 'Needs Review', copy: 'Promising or incomplete signals require manual checks before treating it as investable.' },
  { name: 'High Risk', copy: 'Weak evidence, poor pricing, low yield or specialist-risk wording means extra caution is needed.' },
  { name: 'Evidence Needed', copy: 'Confidence is too low because key evidence such as price, rent or comparable sales is missing.' },
];

const dataUsed = [
  'asking price',
  'nearby sold prices',
  'rent evidence',
  'yield',
  'price reductions',
  'chain-free, auction and value-add wording',
  'data quality',
];

export default function DealLabelExplainer({ compact = false, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const modal = open && typeof document !== 'undefined'
    ? createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">
                  Investor Deal Label
                </div>
                <h2 id={titleId} className="mt-1 text-xl font-black tracking-tight text-slate-950 dark:text-white">
                  How PropNexus deal labels work
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                aria-label="Close deal label explainer"
              >
                <FiX className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              PropNexus labels are evidence-backed investor readouts. They are separate from the AI Deal Score and use available listing, rent and comparable-market evidence rather than a fixed or hardcoded label.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {labels.map((item) => (
                <div key={item.name} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="text-sm font-black text-slate-950 dark:text-white">{item.name}</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{item.copy}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50/60 p-4 dark:border-brand-900/50 dark:bg-brand-950/20">
              <div className="text-sm font-black text-slate-950 dark:text-white">Data used</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {dataUsed.map((item) => (
                  <span key={item} className="rounded-full border border-white/80 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-200">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-300/25 dark:bg-amber-400/10 dark:text-amber-100">
              {getDealLabelLegalCopy()}
            </p>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <span className={`inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={compact
          ? 'inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
          : 'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm transition hover:border-brand-200 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-700 dark:hover:text-brand-200'}
        aria-label="Explain investor deal labels"
      >
        <FiInfo className="h-3.5 w-3.5" aria-hidden="true" />
        {compact ? null : <span>How labels work</span>}
      </button>
      {modal}
    </span>
  );
}
