"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';

import InvestmentSummary from '@/components/property_details/InvestmentSummary';
import ExitStrategyGenerator from '@/components/property_details/ExitStrategyGenerator';
import MortgageCalculator from '@/components/property_details/MortgageCalculator';
import StampDutyCalculator from '@/components/property_details/StampDutyCalculator';
import NotesFields from '@/components/property_details/NotesFields';
import AIChatbot from '@/components/property_details/AIChatbot';

import type { Property } from '@/types';
import { getSupabase } from '@/lib/supabaseClient';

type LooseProperty = Partial<Property> & {
  latitude?: number | null;
  longitude?: number | null;
  imageurl?: string | null; // some rows use this
};

const toNum = (v: unknown) =>
  typeof v === 'number' ? v : v == null || v === '' ? undefined : Number(v);

export default function PropertyDetailsPage() {
  const { id } = useParams() as { id: string };
  const sb = useMemo(() => getSupabase(), []);
  const [property, setProperty] = useState<LooseProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Read EXACTLY the same source as the listings page
        const { data, error } = await sb
          .from('properties')
          .select('*')
          .eq('id', id)
          .single();

<<<<<<< HEAD
        if (error) throw error;
=======
  async function handleSaveDeal() {
    if (!property) return;
    try {
      const base = getBackendBase();
      const resp = await fetch(`${base}/save-deal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: property.id }),
      });
      if (!resp.ok) throw new Error(`Save failed: ${resp.status}`);
      alert('Deal saved!');
    } catch (e) {
      console.error(e);
      alert('Could not save this deal.');
    }
  }
>>>>>>> bd565100 (feat(ai): add strategy + summary fixes, scraper updates, and TS type cleanup)

        // Normalize a few fields the UI expects
        const p: LooseProperty | null = data
          ? {
              ...data,
              // make sure these are numbers or undefined
              price: toNum((data as any).price),
              bedrooms: toNum((data as any).bedrooms),
              bathrooms: toNum((data as any).bathrooms),
              yield_percent: toNum((data as any).yield_percent),
              roi_percent: toNum((data as any).roi_percent),
              latitude: toNum((data as any).latitude) ?? null,
              longitude: toNum((data as any).longitude) ?? null,
            }
          : null;

        if (!cancelled) setProperty(p);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setError(e?.message ?? 'Failed to load property.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

<<<<<<< HEAD
    return () => {
      cancelled = true;
=======
  // Normalize nullable numerics for components that expect numbers
  const normalizedForSummary = useMemo(() => {
    if (!property) return null;
    return {
      ...property,
      price: Number(property.price ?? 0),
      bedrooms: Number(property.bedrooms ?? 0),
      bathrooms: Number(property.bathrooms ?? 0),
      yield_percent: Number(property.yield_percent ?? 0),
      roi_percent: Number(property.roi_percent ?? 0),
>>>>>>> bd565100 (feat(ai): add strategy + summary fixes, scraper updates, and TS type cleanup)
    };
  }, [id, sb]);

  if (loading) {
    return (
      <Section>
        <p>Loading property details…</p>
      </Section>
    );
  }
  if (error) {
    return (
      <Section>
        <p className="text-red-600">{error}</p>
      </Section>
    );
  }
  if (!property) {
    return (
      <Section>
        <p>No property found.</p>
      </Section>
    );
  }

  const price = typeof property.price === 'number' ? property.price : 0;

  return (
    <Section>
      <SectionTitle>{property.title ?? 'Property Details'}</SectionTitle>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Indicative scorecard */}
          <div className="card p-4">
            <h2 className="font-semibold text-lg mb-2">AI Deal Score (indicative)</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Yield:</div>
              <div>{property.yield_percent ?? 0}%</div>
              <div>ROI:</div>
              <div>{property.roi_percent ?? 0}%</div>
              <div>Bedrooms:</div>
              <div>{property.bedrooms ?? '—'}</div>
              <div>Bathrooms:</div>
              <div>{property.bathrooms ?? '—'}</div>
            </div>
          </div>

          {/* Investment Summary */}
          <div className="card p-4">
            <h2 className="font-semibold text-lg mb-2">Investment Summary</h2>
            <InvestmentSummary property={property as any} />
          </div>

          {/* Exit Strategies */}
          <div className="card p-4">
            <h2 className="font-semibold text-lg mb-2">Exit Strategies</h2>
            <ExitStrategyGenerator
              title={String(property.title ?? '')}
              location={String(property.location ?? '')}
              price={typeof property.price === 'number' ? property.price : undefined}
              yield_percent={
                typeof property.yield_percent === 'number' ? property.yield_percent : undefined
              }
              roi_percent={
                typeof property.roi_percent === 'number' ? property.roi_percent : undefined
              }
              propertyType={(property as any).propertyType ?? undefined}
              investmentType={(property as any).investmentType ?? undefined}
              description={(property as any).description ?? undefined}
            />
          </div>

          {/* Notes (render sign-in nudge when signed out inside the component) */}
          <div className="card p-4">
            <h2 className="font-semibold text-lg mb-2">Investor Notes</h2>
            {'id' in property ? <NotesFields propertyId={(property as any).id} /> : null}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Mortgage calculator */}
          <div className="card p-4">
            <h2 className="font-semibold text-lg mb-2">Mortgage & BRRR Calculator</h2>
            <MortgageCalculator price={price} />
          </div>

          {/* Stamp Duty */}
          <div className="card p-4">
            <h2 className="font-semibold text-lg mb-2">Stamp Duty Calculator</h2>
            <StampDutyCalculator price={price} />
          </div>

          {/* Location */}
          <div className="card p-4">
            <h2 className="font-semibold text-lg mb-2">Location</h2>
            {typeof property.latitude === 'number' && typeof property.longitude === 'number' ? (
              <iframe
                title="Map"
                width="100%"
                height="250"
                loading="lazy"
                style={{ border: 0 }}
                src={`https://www.google.com/maps?q=${property.latitude},${property.longitude}&z=14&output=embed`}
              />
            ) : (
              <p>Map unavailable — no coordinates provided.</p>
            )}
          </div>
        </div>
      </div>

<<<<<<< HEAD
      {/* Floating local chatbot */}
=======
      {/* RIGHT — Sidebar */}
      <aside className="md:col-span-1 space-y-6">
        <Section aria-labelledby="deal-summary">
          <SectionTitle id="deal-summary" icon={<span>📊</span>}>Deal Summary</SectionTitle>
          <ul className="space-y-2 text-sm">
            <li><Badge>Price</Badge> £{Number(property.price).toLocaleString()}</li>
            <li><Badge>Yield</Badge> {property.yield_percent != null ? `${property.yield_percent}%` : '—'}</li>
            <li><Badge>ROI</Badge> {property.roi_percent != null ? `${property.roi_percent}%` : '—'}</li>
            <li><Badge>Beds</Badge> {property.bedrooms ?? '—'}</li>
            <li><Badge>Baths</Badge> {property.bathrooms ?? '—'}</li>
            {property.propertyType && (<li><Badge>Type</Badge> {property.propertyType}</li>)}
            {property.investmentType && (<li><Badge>Investment</Badge> {property.investmentType}</li>)}
          </ul>
        </Section>

        <Section aria-labelledby="location">
          <SectionTitle id="location" icon={<span>🗺️</span>}>Location</SectionTitle>
          {hasCoords ? (
            <MapSingle property={property as any} height={260} zoom={14} scrollWheelZoom={false} />
          ) : (
            <p className="text-neutral-500">Map unavailable — no coordinates provided.</p>
          )}
        </Section>
      </aside>

>>>>>>> bd565100 (feat(ai): add strategy + summary fixes, scraper updates, and TS type cleanup)
      <AIChatbot property={property as any} />
    </Section>
  );
}