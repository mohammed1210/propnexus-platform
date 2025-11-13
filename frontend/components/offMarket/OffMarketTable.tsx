"use client";

import React from 'react';
import Link from 'next/link';
import type { OffMarketDeal } from '@/lib/offmarket/types';
import { ensureDerivedFields, formatCurrency, formatDate } from '@/lib/offmarket/utils';

type Props = {
  deals: OffMarketDeal[];
};

export default function OffMarketTable({ deals }: Props) {
  if (!deals || deals.length === 0) {
    return <div className="text-center py-12 opacity-70">No deals match your criteria</div>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-50 dark:bg-zinc-900/40 text-left">
          <tr>
            <th className="px-4 py-3">Property</th>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3 text-right">Price</th>
            <th className="px-4 py-3 text-right">Est. Value</th>
            <th className="px-4 py-3 text-right">Discount</th>
            <th className="px-4 py-3 text-center">Score</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3 text-right">Added</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => {
            const d = ensureDerivedFields(deal);
            return (
              <tr key={d.id} className="border-t">
                <td className="px-4 py-3 font-medium">
                  <div className="line-clamp-1">{d.title}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm">
                    <div className="text-foreground/90 line-clamp-1">{d.location || d.address || '—'}</div>
                    <div className="text-foreground/60">{d.postcode || ''}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(d.price)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(d.estimated_value)}</td>
                <td className="px-4 py-3 text-right">{d.discount_percent != null ? `${d.discount_percent.toFixed(0)}%` : '—'}</td>
                <td className="px-4 py-3 text-center">{d.investment_score ?? '—'}</td>
                <td className="px-4 py-3">{d.source || '—'}</td>
                <td className="px-4 py-3 text-right">{formatDate(d.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/off-market/${d.id}`} className="underline">View</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
