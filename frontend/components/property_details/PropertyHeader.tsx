'use client';

import {
  FiDroplet,
  FiHome,
  FiMapPin,
  FiTag,
} from 'react-icons/fi';

type HeaderProperty = {
  title?: string | null;
  location?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  price?: number | null;
  propertyType?: string | null;
};

export default function PropertyHeader({ property }: { property: HeaderProperty }) {
  const hasPrice = typeof property.price === 'number' && Number.isFinite(property.price) && property.price > 0;
  const typeLabel = typeof property.propertyType === 'string' ? property.propertyType.trim() : '';

  return (
    <div className="p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {property.title || 'Property Details'}
          </h1>

          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <FiMapPin className="w-5 h-5 shrink-0" />
              <span className="truncate">{property.location || 'Location not specified'}</span>
            </div>

            {typeLabel ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/30 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <FiTag className="w-4 h-4" aria-hidden />
                {typeLabel}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-4">
            {property.bedrooms !== undefined && property.bedrooms !== null ? (
              <div className="flex items-center gap-2">
                <FiHome className="w-5 h-5 text-brand-500" />
                <span className="text-slate-700 dark:text-slate-300">{property.bedrooms} beds</span>
              </div>
            ) : null}
            {property.bathrooms !== undefined && property.bathrooms !== null ? (
              <div className="flex items-center gap-2">
                <FiDroplet className="w-5 h-5 text-brand-500" />
                <span className="text-slate-700 dark:text-slate-300">{property.bathrooms} baths</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="shrink-0">
          <div className="text-left sm:text-right">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Price</div>
            <div className="text-2xl sm:text-3xl font-bold text-brand-600 dark:text-brand-400">
              {hasPrice ? `£${property.price!.toLocaleString()}` : 'N/A'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
