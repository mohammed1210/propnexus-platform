'use client';

import React from 'react';

import { formatPercent, formatRoiDisplay, getRoiDisplay, getRoiProxyValidationNote, getYieldPercent } from '@/lib/normalizeProperty';

interface QuickStatsCardProps {
  property?: Record<string, any> | null;
  price?: number;
  yieldPercent?: number;
  roiPercent?: number;
  aiScore?: number;
}

const formatValue = (value: number | undefined, format: 'currency' | 'percent' | 'score' = 'currency'): string => {
  if (value === undefined || value === null || isNaN(value)) {
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
      return formatPercent(value);
    case 'score':
      return `${value.toFixed(1)}/10`;
    default:
      return value.toLocaleString('en-GB');
  }
};

export default function QuickStatsCard({ property, price, yieldPercent, roiPercent, aiScore }: QuickStatsCardProps) {
  const merged: Record<string, any> = {
    ...(property ?? {}),
  };
  if (typeof price === 'number') merged.price = price;
  if (typeof yieldPercent === 'number') merged.yieldPercent = yieldPercent;
  if (typeof roiPercent === 'number') merged.roiPercent = roiPercent;

  const displayYield = getYieldPercent(merged) ?? undefined;
  const roiDisplay = getRoiDisplay(merged);
  const displayRoi = roiDisplay.value ?? undefined;
  const roiValidationNote = getRoiProxyValidationNote(roiDisplay);

  return (
    <div className="panel space-y-4">
      <h3 className="font-semibold text-sm text-slate-600 dark:text-slate-400 uppercase tracking-wide">
        Quick Stats
      </h3>

      {price !== undefined && (
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Price</div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {formatValue(price, 'currency')}
          </div>
        </div>
      )}

      {displayYield !== undefined && (
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Yield</div>
          <div className="text-xl font-bold text-green-600 dark:text-green-400">
            {formatValue(displayYield, 'percent')}
          </div>
        </div>
      )}

      {displayRoi !== undefined && (
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">ROI{roiDisplay.isProxy ? ' (proxy)' : ''}</div>
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {formatRoiDisplay(roiDisplay)}
          </div>
          {roiValidationNote ? (
            <p className="mt-1 text-[11px] leading-4 text-amber-600 dark:text-amber-300">{roiValidationNote}</p>
          ) : null}
        </div>
      )}

      {aiScore !== undefined && (
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">AI Score</div>
          <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
            {formatValue(aiScore, 'score')}
          </div>
        </div>
      )}
    </div>
  );
}
