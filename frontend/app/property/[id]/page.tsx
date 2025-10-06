'use client';

import { useEffect, useState } from 'react';
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

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE as string | undefined) ??
  (process.env.NEXT_PUBLIC_API_BASE_URL as string | undefined) ??
  '';

export default function PropertyDetailsPage() {
  const { id } = useParams() as { id: string };
  const [property, setProperty] = useState<Partial<Property> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const base = API_BASE.replace(/\/+$/, '');
        const res = await fetch(`${base}/properties/${id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to fetch property (${res.status})`);
        const data = await res.json();
        setProperty(data ?? null);
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? 'Failed to load property.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <Section>
        <p>Loading property details...</p>
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

  const price = typeof property.price === 'number' ? property.price : undefined;

  return (
    <Section>
      <SectionTitle>{property.title ?? 'Property Details'}</SectionTitle>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Indicative scorecard */}
          <div className="border p-4 rounded-md">
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
          <div className="border p-4 rounded-md">
            <h2 className="font-semibold text-lg mb-2">Investment Summary</h2>
            <InvestmentSummary property={property as any} />
          </div>

          {/* Exit Strategies */}
          <div className="border p-4 rounded-md">
            <h2 className="font-semibold text-lg mb-2">Exit Strategies</h2>
            <ExitStrategyGenerator
              title={String(property.title ?? '')}
              location={String(property.location ?? '')}
              price={price}
              yield_percent={
                typeof property.yield_percent === 'number' ? property.yield_percent : undefined
              }
              roi_percent={
                typeof property.roi_percent === 'number' ? property.roi_percent : undefined
              }
              propertyType={property.propertyType ?? undefined}
              investmentType={property.investmentType ?? undefined}
              description={property.description ?? undefined}
            />
          </div>

          {/* Notes */}
          <div className="border p-4 rounded-md">
            <h2 className="font-semibold text-lg mb-2">Investor Notes</h2>
            {'id' in property ? <NotesFields propertyId={(property as any).id} /> : null}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Mortgage calculator */}
          <div className="border p-4 rounded-md">
            <h2 className="font-semibold text-lg mb-2">Mortgage & BRRR Calculator</h2>
            <MortgageCalculator price={price ?? 0} />
          </div>

          {/* Stamp Duty */}
          <div className="border p-4 rounded-md">
            <h2 className="font-semibold text-lg mb-2">Stamp Duty Calculator</h2>
            <StampDutyCalculator price={price ?? 0} />
          </div>

          {/* Location */}
          {typeof property.latitude === 'number' && typeof property.longitude === 'number' ? (
            <div className="border p-4 rounded-md">
              <h2 className="font-semibold text-lg mb-2">Location</h2>
              <iframe
                title="Map"
                width="100%"
                height="250"
                loading="lazy"
                style={{ border: 0 }}
                src={`https://www.google.com/maps?q=${property.latitude},${property.longitude}&z=14&output=embed`}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Floating local chatbot */}
      <AIChatbot property={property as any} />
    </Section>
  );
}
