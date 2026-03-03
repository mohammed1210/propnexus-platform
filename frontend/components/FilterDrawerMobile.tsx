'use client';

import { useEffect, useMemo, useState } from 'react';

import FilterBar, { type FilterBarValue } from '@/components/FilterBar';

type Props = {
  value: FilterBarValue;
  onChange: (next: FilterBarValue) => void;
  onReset: () => void;
  onApply?: () => void;
};

export default function FilterDrawerMobile({ value, onChange, onReset, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const serialized = useMemo(() => JSON.stringify(value), [value]);

  useEffect(() => {
    try {
      localStorage.setItem('searchFilters', serialized);
    } catch {
      return;
    }
  }, [serialized]);

  return (
    <>
      <button
        type="button"
        className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-brand-500 px-5 py-2 text-white shadow-lg sm:hidden"
        onClick={() => setOpen(true)}
        aria-label="Filters"
      >
        Filters
      </button>

      {open && (
        <div className="fixed inset-0 z-40 sm:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label="Close filters"
            onClick={() => setOpen(false)}
          />

          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-2 text-lg font-semibold">Filters</h2>
            <FilterBar value={value} onChange={onChange} onReset={onReset} />
            <button
              type="button"
              className="mt-4 w-full rounded bg-brand-500 py-2 text-white"
              onClick={() => {
                onApply?.();
                setOpen(false);
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </>
  );
}
