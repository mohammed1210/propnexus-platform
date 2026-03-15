'use client';

import { useEffect, useMemo, useState } from 'react';
import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';

import FilterBar, { type FilterBarValue } from '@/components/FilterBar';

type Props = {
  value: FilterBarValue;
  onChange: (next: FilterBarValue) => void;
  onReset: () => void;
  onApply?: () => void;
};

export default function FilterDrawerMobile({ value, onChange, onReset, onApply }: Props) {
  const t = useTranslations('filters');
  const [open, setOpen] = useState(false);
  const serialized = useMemo(() => JSON.stringify(value), [value]);

  useEffect(() => {
    const prefersMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

    if (open && prefersMotion) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    try {
      localStorage.setItem('searchFilters', serialized);
    } catch {
      return;
    }
  }, [serialized]);

  return (
    <div className="md:hidden">
      <div
        aria-hidden="true"
        className={`transition-[max-height] duration-300 ${open ? 'max-h-[70vh]' : 'max-h-0'}`}
      />

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-filter-drawer"
        aria-label={t('open')}
        className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <FunnelIcon className="h-4 w-4" />
        {t('open')}
      </button>

      <div
        id="mobile-filter-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        className={`fixed inset-x-0 bottom-0 z-50 h-[70vh] rounded-t-2xl border border-slate-200 bg-white shadow-xl transition-transform duration-300 dark:border-slate-700 dark:bg-slate-900 ${
          open ? 'translate-y-0' : 'translate-y-full'
        } motion-reduce:transition-none`}
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-2 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <XMarkIcon className="h-6 w-6" />
            <span className="sr-only">Close filters panel</span>
          </button>
        </header>

        <div className="size-full overflow-y-auto p-4">
          <FilterBar value={value} onChange={onChange} onReset={onReset} />
          <button
            type="button"
            className="mt-4 w-full rounded bg-brand-500 py-2 text-white"
            onClick={() => {
              onApply?.();
              setOpen(false);
            }}
          >
            {t('apply')}
          </button>
        </div>
      </div>

      {open && (
        <button
          type="button"
          aria-label="Close filters backdrop"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none"
        />
      )}
    </div>
  );
}
