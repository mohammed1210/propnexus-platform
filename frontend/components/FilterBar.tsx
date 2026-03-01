'use client';

import { useMemo } from 'react';

import { track } from '@/utils/analytics';

export type FilterBarValue = {
  bedsMin?: number;
  bedsMax?: number;
  priceMin: number;
  priceMax: number;
  yieldMin: number;
};

type Props = {
  value: FilterBarValue;
  onChange: (next: FilterBarValue) => void;
  onReset: () => void;
};

const BED_OPTIONS = [1, 2, 3, 4] as const;

export default function FilterBar({ value, onChange, onReset }: Props) {
  const selectedBeds = useMemo(() => {
    if (typeof value.bedsMin !== 'number' || typeof value.bedsMax !== 'number') return new Set<number>();
    const set = new Set<number>();
    for (let i = value.bedsMin; i <= value.bedsMax; i += 1) {
      set.add(i);
    }
    return set;
  }, [value.bedsMax, value.bedsMin]);

  const toggleBed = async (bed: number) => {
    const nextSet = new Set<number>(selectedBeds);
    if (nextSet.has(bed)) nextSet.delete(bed);
    else nextSet.add(bed);

    const arr = Array.from(nextSet).sort((a, b) => a - b);
    const bedsMin = arr.length ? arr[0] : undefined;
    const bedsMax = arr.length ? arr[arr.length - 1] : undefined;

    onChange({ ...value, bedsMin, bedsMax });
    await track('filter_select', {
      facet: 'beds',
      value: bedsMin && bedsMax ? `${bedsMin}-${bedsMax}` : 'any',
    });
  };

  return (
    <section className="rounded-xl border p-4" style={{ borderColor: 'var(--border-primary)', background: 'var(--card-bg)' }}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-sm font-medium">Beds</p>
          <div className="flex flex-wrap gap-2">
            {BED_OPTIONS.map((bed) => {
              const label = bed === 4 ? '4+' : String(bed);
              const active = selectedBeds.has(bed);
              return (
                <button
                  key={bed}
                  type="button"
                  onClick={() => void toggleBed(bed)}
                  className={`rounded-full border px-3 py-1 text-sm ${active ? 'bg-black text-white' : ''}`}
                  aria-pressed={active}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Price (£)</p>
          <div className="flex flex-col gap-2">
            <input
              type="range"
              min={0}
              max={1000000}
              step={10000}
              value={value.priceMin}
              onChange={(e) => {
                const nextMin = Number(e.target.value);
                const nextMax = Math.max(nextMin, value.priceMax);
                onChange({ ...value, priceMin: nextMin, priceMax: nextMax });
              }}
            />
            <input
              type="range"
              min={0}
              max={1000000}
              step={10000}
              value={value.priceMax}
              onChange={(e) => {
                const nextMax = Number(e.target.value);
                const bounded = Math.max(nextMax, value.priceMin);
                onChange({ ...value, priceMax: bounded });
                void track('filter_select', {
                  facet: 'price',
                  value: `0-${Math.round(bounded / 1000)}k`,
                });
              }}
            />
            <p className="text-xs text-gray-500">£{value.priceMin.toLocaleString()} - £{value.priceMax.toLocaleString()}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Yield (%)</p>
          <input
            type="range"
            min={0}
            max={15}
            step={0.5}
            value={value.yieldMin * 100}
            onChange={(e) => {
              const next = Number(e.target.value) / 100;
              onChange({ ...value, yieldMin: next });
              void track('filter_select', {
                facet: 'yield',
                value: `>=${Math.round(next * 100)}%`,
              });
            }}
          />
          <p className="text-xs text-gray-500">Minimum {Math.round(value.yieldMin * 1000) / 10}%</p>
        </div>

        <div>
          <button type="button" onClick={onReset} className="rounded-md border px-3 py-2 text-sm">
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}
