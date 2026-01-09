'use client';

import React from 'react';

interface PropertySummaryCardProps {
  property: {
    title?: string | null;
    location?: string | null;
    price?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    propertyType?: string | null;
    investmentType?: string | null;
  };
  metrics?: {
    ltv?: number;
    monthlyPayment?: number;
    netCashflow?: number;
    yield?: number;
    roi?: number;
  };
}

const formatValue = (value: number | null | undefined, format: 'currency' | 'percent' | 'number' = 'number'): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        maximumFractionDigits: 0,
      }).format(value);
    case 'percent':
      return `${value.toFixed(1)}%`;
    default:
      return value.toLocaleString('en-GB');
  }
};

export default function PropertySummaryCard({ property, metrics }: PropertySummaryCardProps) {
  const { title, location, price, bedrooms, bathrooms, propertyType, investmentType } = property;

  return (
    <div className="card">
      <div className="space-y-4">
        {/* Property Details */}
        <div>
          <h2 className="text-2xl font-bold mb-2">{title || 'Property Details'}</h2>
          {location && (
            <p className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <span>📍</span>
              {location}
            </p>
          )}
        </div>

        {/* Key Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Price</p>
            <p className="text-lg font-semibold">{formatValue(price, 'currency')}</p>
          </div>

          {bedrooms !== undefined && bedrooms !== null && (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Bedrooms</p>
              <p className="text-lg font-semibold">{formatValue(bedrooms)}</p>
            </div>
          )}

          {bathrooms !== undefined && bathrooms !== null && (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Bathrooms</p>
              <p className="text-lg font-semibold">{formatValue(bathrooms)}</p>
            </div>
          )}

          {propertyType && (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Type</p>
              <p className="text-lg font-semibold">{propertyType}</p>
            </div>
          )}
        </div>

        {/* Investment Metrics */}
        {metrics && (
          <>
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wide">
                Investment Metrics
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {metrics.ltv !== undefined && (
                  <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">LTV</p>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {formatValue(metrics.ltv, 'percent')}
                    </p>
                  </div>
                )}

                {metrics.monthlyPayment !== undefined && (
                  <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Monthly Payment</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {formatValue(metrics.monthlyPayment, 'currency')}
                    </p>
                  </div>
                )}

                {metrics.netCashflow !== undefined && (
                  <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Net Cashflow</p>
                    <p className={`text-xl font-bold ${
                      metrics.netCashflow >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatValue(metrics.netCashflow, 'currency')}
                    </p>
                  </div>
                )}

                {metrics.yield !== undefined && (
                  <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Yield</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatValue(metrics.yield, 'percent')}
                    </p>
                  </div>
                )}

                {metrics.roi !== undefined && (
                  <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">ROI</p>
                    <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                      {formatValue(metrics.roi, 'percent')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {investmentType && (
          <div className="pt-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              {investmentType}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
