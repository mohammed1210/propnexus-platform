'use client';

// Note: This file intentionally uses a minimal props type
// so that it remains compatible with Next's generated PageProps
// check in .next/types without depending on local helpers.

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import PageWrapper from '@/components/PageWrapper';
import { getSupabase } from '@/lib/supabaseClient';
import type { OffMarketDeal } from '@/lib/offmarket/types';
import { ensureDerivedFields, formatCurrency, formatDate } from '@/lib/offmarket/utils';

// Match Next's generated PageProps exactly: params/searchParams as Promises.
type PageProps = {
  params?: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, unknown>>;
};

export default function DealDetail({ params }: PageProps) {
  const [id, setId] = useState<string | null>(null);
  const sb = useMemo(() => getSupabase(), []);
  const [row, setRow] = useState<OffMarketDeal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!params) return;
      const resolved = await params;
      if (cancelled) return;
      setId(resolved.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (!id) return;
    let ignore = false;
    (async () => {
      setLoading(true);
      const { data, error } = await sb
        .from('off_market_deals')
        .select('*')
        .eq('id', id)
        .limit(1)
        .maybeSingle();
      if (ignore) return;
      if (error) {
        console.error(error);
        setRow(null);
      } else if (data) {
        const mapped: OffMarketDeal = {
          id: data.id,
          title: data.title || 'Untitled',
          location: data.location,
          price: data.price ?? null,
          bedrooms: data.bedrooms ?? null,
          bathrooms: data.bathrooms ?? null,
          notes: data.notes ?? null,
          source: data.source ?? null,
          created_at: data.created_at ?? null,
          image_url: data.image_url ?? null,
        };
        setRow(ensureDerivedFields(mapped));
      } else {
        setRow(null);
      }
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, [sb, id]);

  return (
    <PageWrapper showOrbs={false}>
      <Section>
        <div className="mb-3 text-sm">
          <Link href="/off-market" className="underline">← Back to Off-Market</Link>
        </div>
        <SectionTitle>Deal Details</SectionTitle>
        {loading ? (
          <div className="card p-4">Loading…</div>
        ) : !row ? (
          <div className="card p-4">Deal not found.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="card overflow-hidden">
                {row.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.image_url} alt={row.title} className="w-full h-80 object-cover" />
                ) : (
                  <div className="w-full h-80 grid place-items-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                    No photo
                  </div>
                )}
              </div>

              <div className="card p-4 space-y-3">
                <div className="text-2xl font-semibold">{row.title}</div>
                <div className="text-sm opacity-70">{row.location || row.postcode || '—'}</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Metric label="Price" value={formatCurrency(row.price)} />
                  <Metric label="Est. Value" value={formatCurrency(row.estimated_value)} />
                  <Metric label="Discount" value={row.discount_percent != null ? `${row.discount_percent.toFixed(0)}%` : '—'} />
                  <Metric label="Score" value={row.investment_score != null ? String(row.investment_score) : '—'} />
                  <Metric label="Bedrooms" value={row.bedrooms != null ? String(row.bedrooms) : '—'} />
                  <Metric label="Bathrooms" value={row.bathrooms != null ? String(row.bathrooms) : '—'} />
                </div>
                {row.notes ? <p className="text-sm">{row.notes}</p> : null}
                <div className="text-xs opacity-60">Added {formatDate(row.created_at)}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="card p-4">
                <div className="font-medium mb-2">Actions</div>
                <div className="space-y-2">
                  <a className="block underline text-sm" href="/off-market">Export JSON (coming soon)</a>
                  <a className="block underline text-sm" href="/off-market">Download PDF (coming soon)</a>
                </div>
              </div>

              <div className="card p-4">
                <div className="font-medium mb-2">Meta</div>
                <div className="text-sm space-y-1">
                  <div>Source: {row.source || '—'}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Section>
    </PageWrapper>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs opacity-70">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
