// frontend/app/property/[id]/page.tsx
import React from 'react';
import { notFound } from 'next/navigation';
import InvestmentSummary from '@/components/property_details/InvestmentSummary';
import AIChatbot from '@/components/property_details/AIChatbot';
import { getSupabase } from '@/lib/supabaseClient';

/** Correct PageProps shape for Next.js app router */
interface PageProps {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}

/** Convert DB values to numbers or undefined */
function numOrUndef(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Normalize DB property row */
function normalizeProperty(raw: any) {
  if (!raw) return null;

  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),        // required string
    location: String(raw.location ?? ''),  // required string

    description: raw.description ?? undefined,
    propertyType: raw.propertyType ?? raw.property_type ?? undefined,
    investmentType: raw.investmentType ?? raw.investment_type ?? undefined,

    price: numOrUndef(raw.price),
    bedrooms: numOrUndef(raw.bedrooms),
    bathrooms: numOrUndef(raw.bathrooms),
    yield_percent: numOrUndef(raw.yield_percent ?? raw.yield),
    roi_percent: numOrUndef(raw.roi_percent ?? raw.roi),

    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    avg_rent: numOrUndef(raw.avg_rent),
    crime_index: numOrUndef(raw.crime_index),
    ofsted_summary: raw.ofsted_summary ?? null,
    transport_summary: raw.transport_summary ?? null,
  };
}

async function fetchPropertyById(id: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Supabase error:', error);
    return null;
  }
  return data;
}

export default async function PropertyPage({ params }: PageProps) {
  const { id } = params;

  const raw = await fetchPropertyById(id);
  if (!raw) return notFound();

  const property = normalizeProperty(raw);
  if (!property) return notFound();

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      {/* ======= Your header / score / details above ======= */}

      <section className="mt-6">
        <h3 className="mb-2 text-lg font-semibold">Investment Summary</h3>
        <InvestmentSummary property={property as any} />
      </section>

      {/* Other panels (Exit strategies, Mortgage calc, etc.) */}

      <AIChatbot property={property as any} />
    </div>
  );
}
