// frontend/app/property/[id]/page.tsx
import React from 'react';
import { notFound } from 'next/navigation';
import InvestmentSummary from '@/components/property_details/InvestmentSummary';
import AIChatbot from '@/components/property_details/AIChatbot';
import { getSupabase } from '@/lib/supabaseClient';

/** Route params */
type RouteParams = { params: { id: string } };

/** Convert DB values to numbers or undefined (never 0/'' by accident) */
function numOrUndef(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Make sure strings are never null and keys match what the UI expects */
function normalizeProperty(raw: any) {
  if (!raw) return null;

  return {
    id: String(raw.id ?? ''),
    // ↓↓↓ required by AI endpoints – must be strings (can be '')
    title: String(raw.title ?? ''),
    location: String(raw.location ?? ''),

    // optional text
    description: raw.description ?? undefined,
    propertyType: raw.propertyType ?? raw.property_type ?? undefined,
    investmentType: raw.investmentType ?? raw.investment_type ?? undefined,

    // optional numbers
    price: numOrUndef(raw.price),
    bedrooms: numOrUndef(raw.bedrooms),
    bathrooms: numOrUndef(raw.bathrooms),
    yield_percent: numOrUndef(raw.yield_percent ?? raw.yield),
    roi_percent: numOrUndef(raw.roi_percent ?? raw.roi),

    // extras used by the floating chatbot (keep as-is if null)
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    avg_rent: numOrUndef(raw.avg_rent),
    crime_index: numOrUndef(raw.crime_index),
    ofsted_summary: raw.ofsted_summary ?? null,
    transport_summary: raw.transport_summary ?? null,
  };
}

/**
 * Fetch a single property either from Supabase (default)
 * or from your FastAPI if you prefer. Keep the Supabase
 * path unless you’ve already wired an API route.
 */
async function fetchPropertyById(id: string) {
  // --- Supabase (current project default) ---
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('properties') // <-- change table name if yours differs
    .select('*')
    .eq('id', id)
    .maybeSingle(); // returns null instead of throwing if not found

  if (error) {
    // Let the page 404 if we truly can't retrieve it
    return null;
  }
  return data;
}

export default async function PropertyPage({ params }: RouteParams) {
  const id = params.id;

  const raw = await fetchPropertyById(id);
  if (!raw) return notFound();

  const property = normalizeProperty(raw);
  if (!property) return notFound();

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      {/* ======= Your existing header / actions / score / summary blocks go here ======= */}
      {/* Keep all your existing JSX above the InvestmentSummary */}

      {/* Investment Summary – now receives safe strings/numbers */}
      <section className="mt-6">
        <h3 className="mb-2 text-lg font-semibold">Investment Summary</h3>
        <InvestmentSummary property={property as any} />
      </section>

      {/* ... other panels (Exit strategies button, calculator, insights, notes, etc.) ... */}

      {/* Floating AI widget (local heuristic replies) */}
      <AIChatbot property={property as any} />
    </div>
  );
}
