'use client';

import React from 'react';
import InvestmentSummary from './InvestmentSummary';

interface PropertySummaryCardProps {
  property: {
    title?: string | null;
    location?: string | null;
    price?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    propertyType?: string | null;
    investmentType?: string | null;
    description?: string | null;
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
  const { title, location, price, bedrooms, bathrooms, propertyType, investmentType, description } = property;
  
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

        {/* Investment Metrics as Badges */}
        {(metrics?.yield !== undefined || metrics?.roi !== undefined) && (
          <div className="flex flex-wrap gap-2">
            {metrics.yield !== undefined && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="mr-1">📈</span>
                Yield: {formatValue(metrics.yield, 'percent')}
              </span>
            )}
            
            {metrics.roi !== undefined && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                <span className="mr-1">💰</span>
                ROI: {formatValue(metrics.roi, 'percent')}
              </span>
            )}
          </div>
        )}

        {/* Investment Summary */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wide">
            Investment Summary
          </h3>
          <InvestmentSummary 
            property={{
              title: title || '',
              location: location || '',
              price: price,
              bedrooms: bedrooms,
              bathrooms: bathrooms,
              yield_percent: metrics?.yield,
              roi_percent: metrics?.roi,
              propertyType: propertyType,
              investmentType: investmentType,
              description: description,
            }} 
          />
        </div>

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
