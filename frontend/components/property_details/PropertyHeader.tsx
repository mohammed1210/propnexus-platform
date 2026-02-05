'use client';

import {
  FiDroplet,
  FiHome,
  FiMapPin,
  FiTrendingUp,
} from 'react-icons/fi';

type HeaderProperty = {
  title?: string | null;
  location?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  price?: number | null;
  yield_percent?: number | null;
  description?: string | null;
};

export default function PropertyHeader({ property }: { property: HeaderProperty }) {
  const description = typeof property.description === 'string' ? property.description.trim() : '';

  return (
    <>
      {/* Property details (below image, above description) */}
      <div className="p-6 pt-5 border-t border-slate-200 dark:border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
              {property.title || 'Property Details'}
            </h1>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-3">
              <FiMapPin className="w-5 h-5 shrink-0" />
              <span className="truncate">{property.location || 'Location not specified'}</span>
            </div>
            <div className="flex flex-wrap gap-4">
              {property.bedrooms !== undefined && property.bedrooms !== null && (
                <div className="flex items-center gap-2">
                  <FiHome className="w-5 h-5 text-brand-500" />
                  <span className="text-slate-700 dark:text-slate-300">
                    {property.bedrooms} beds
                  </span>
                </div>
              )}
              {property.bathrooms !== undefined && property.bathrooms !== null && (
                <div className="flex items-center gap-2">
                  <FiDroplet className="w-5 h-5 text-brand-500" />
                  <span className="text-slate-700 dark:text-slate-300">
                    {property.bathrooms} baths
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="text-left lg:text-right">
              <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Price</div>
              <div className="text-2xl sm:text-3xl font-bold text-brand-600 dark:text-brand-400">
                £{(property.price ?? 0).toLocaleString()}
              </div>
            </div>
            {typeof property.yield_percent === 'number' && (
              <div className="flex items-center gap-2">
                <FiTrendingUp className="w-5 h-5 text-emerald-500" />
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  {property.yield_percent.toFixed(1)}% yield
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {description ? (
        <div className="p-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
            Description
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
            {description.split(/\n{2,}/).map((para, idx) => {
              const t = para.trim();
              if (!t) return null;
              return <p key={idx}>{t}</p>;
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
