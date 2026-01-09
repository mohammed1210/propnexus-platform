"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { OffMarketDeal } from '@/lib/offmarket/types';
import { ensureDerivedFields, formatCurrency } from '@/lib/offmarket/utils';

type Props = {
  deal: OffMarketDeal;
};

export default function OffMarketCard({ deal }: Props) {
  const d = ensureDerivedFields(deal);
  const img = d.image_url || d.imageurl || null;
  const discount = d.discount_percent != null ? `${d.discount_percent.toFixed(0)}% off` : null;

  return (
    <div className="card overflow-hidden">
      {img ? (
        <div className="relative w-full aspect-[16/10] bg-zinc-100 dark:bg-zinc-800">
          <Image 
            src={img} 
            alt={d.title} 
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
            unoptimized={img.includes('supabase') ? false : true}
          />
        </div>
      ) : (
        <div className="w-full aspect-[16/10] grid place-items-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-sm">
          No photo
        </div>
      )}

      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium line-clamp-1">{d.title}</div>
            <div className="text-sm opacity-70 line-clamp-1">{d.location || d.postcode || '—'}</div>
          </div>
          {discount ? (
            <span className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              {discount}
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between">
          <div className="font-semibold">{formatCurrency(d.price)}</div>
          {d.investment_score != null ? (
            <span className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
              Score {d.investment_score}
            </span>
          ) : null}
        </div>

        <div>
          <Link className="underline text-sm" href={`/off-market/${d.id}`}>
            View details
          </Link>
        </div>
      </div>
    </div>
  );
}
