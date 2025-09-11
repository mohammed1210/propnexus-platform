'use client';

import Image from 'next/image';
import Link from 'next/link';
import Button from '@/components/ui/Button';

export type PropertyCardProps = {
  href?: string; // e.g. `/property/${id}`
  property: {
    id: string;
    title: string;
    location: string;
    price: number;
    bedrooms?: number | null;
    bathrooms?: number | null;
    yield_percent?: number | null;
    roi_percent?: number | null;
    imageurl?: string | null;
  };
  onSave?: () => void;
};

export default function PropertyCard({ href, property, onSave }: PropertyCardProps) {
  const { title, location, price, bedrooms, bathrooms, yield_percent, roi_percent, imageurl } = property;

  return (
    <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Image */}
      <div className="relative h-40 w-full">
        {imageurl ? (
          <Image
            src={imageurl}
            alt={title}
            fill
            sizes="(max-width:768px) 100vw, 33vw"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-slate-400 text-sm">No image</div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 md:p-4 space-y-1.5">
        <h3 className="text-base md:text-lg font-semibold leading-tight">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">{location}</p>

        <div className="mt-1.5 text-lg font-bold">£{Number(price).toLocaleString()}</div>

        <div className="mt-1.5 flex gap-4 text-sm text-slate-600 dark:text-slate-300">
          <span>🛏 {bedrooms ?? '—'}</span>
          <span>🛁 {bathrooms ?? '—'}</span>
        </div>

        <div className="text-sm text-slate-600 dark:text-slate-300">
          Yield: {yield_percent != null ? `${yield_percent}%` : '—'} · ROI: {roi_percent != null ? `${roi_percent}%` : '—'}
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          {onSave && (
            <Button size="sm" variant="secondary" onClick={onSave}>
              Save Deal
            </Button>
          )}

          {href ? (
            <Link
              href={href}
              prefetch
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              View Details
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}