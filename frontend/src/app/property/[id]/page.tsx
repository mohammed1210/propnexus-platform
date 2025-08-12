'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import AIChatbot from '@details/AIChatbot';
import InvestmentSummary from '@details/InvestmentSummary';
import ExitStrategyGenerator from '@details/ExitStrategyGenerator';
import MortgageCalculator from '@details/MortgageCalculator';
import StampDutyCalculator from '@details/StampDutyCalculator';
import NotesFields from '@details/NotesFields';
import AreaIntel from '@details/AreaIntel';
import MapSingle from '@details/MapSingle';
import AIScoreBars from '@details/AIScoreBars';
import AIScoreInfo, { triggerAIScoreInfo } from '@details/AIScoreInfo';
import { Property } from '@/types';
import InvestmentInsights from '@details/InvestmentInsights';
import CompsMini from '@details/CompsMini';
import ExportActions from '@details/ExportActions';

export default function PropertyDetailsPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined);

  // Prefer NEXT_PUBLIC_API_URL but fall back safely
  const BACKEND_BASE = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '').trim();

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchProperty = async () => {
      try {
        setLoading(true);
        setError(null);

        const useBackend = Boolean(BACKEND_BASE && BACKEND_BASE.startsWith('http'));
        const url = useBackend ? `${BACKEND_BASE}/api/properties/${id}` : `/api/properties/${id}`;

        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const raw = await res.json();

        // Normalize to keep components happy
        const p: Property = {
          ...raw,
          price: Number(raw.price ?? 0),
          yield_percent: Number(raw.yield_percent ?? raw.yield ?? 0),
          roi_percent: Number(raw.roi_percent ?? raw.roi ?? 0),
          latitude: raw.latitude != null ? Number(raw.latitude) : undefined,
          longitude: raw.longitude != null ? Number(raw.longitude) : undefined,
          propertyType: raw.propertyType ?? raw.property_type ?? '',
          investmentType: raw.investmentType ?? raw.investment_type ?? '',
        };

        setProperty(p);
      } catch (err) {
        console.error('Failed to fetch property:', err);
        setError('Sorry — we couldn’t load this property.');
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, [id, BACKEND_BASE]);

  const hasCoords = useMemo(
    () => Boolean(property?.latitude != null && property?.longitude != null),
    [property?.latitude, property?.longitude]
  );

  // ===== AI score bars (demo values — swap to real scoring when ready)
  const aiOverall: number =
    typeof (property as any)?.ai_score === 'number'
      ? (property as any).ai_score
      : Math.round(
          [
            Math.min(100, Math.max(0, Math.round((property?.yield_percent ?? 0) * 10))), // yield
            Math.min(100, Math.max(0, Math.round((property?.roi_percent ?? 0) * 5))),   // ROI
            68, // area demand (placeholder)
            60, // risk inverted-ish (placeholder)
          ].reduce((a, b) => a + b, 0) / 4
        );

  const aiItems = [
    {
      key: 'yield',
      label: 'Yield Strength',
      value: Math.min(100, Math.max(0, Math.round((property?.yield_percent ?? 0) * 10))),
      hint: 'Estimated gross yield vs local averages.',
    },
    {
      key: 'roi',
      label: 'ROI Potential',
      value: Math.min(100, Math.max(0, Math.round((property?.roi_percent ?? 0) * 5))),
      hint: 'Projected ROI given refurb & exit assumptions.',
    },
    {
      key: 'demand',
      label: 'Area Demand',
      value: 68,
      hint: 'Rental demand and stock turnover (illustrative).',
    },
    {
      key: 'risk',
      label: 'Risk Adjusted',
      value: 60,
      hint: 'Lower risk → higher score (illustrative).',
    },
  ];

  // ===== Safe postcode resolver for AreaIntel
  const postcode: string | undefined =
    (property as any)?.postcode ??
    (property as any)?.post_code ??
    (property as any)?.postal_code ??
    undefined;

  /* ================================
   * Loading / error states
   * ================================ */
  if (loading) {
    return (
      <div className="px-4 md:px-12 py-6" aria-busy="true" aria-live="polite">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-2/3 bg-slate-200 rounded" />
          <div className="h-4 w-1/3 bg-slate-200 rounded" />
          <div className="h-64 w-full bg-slate-200 rounded" />
          <div className="h-32 w-full bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 font-medium">{error ?? 'Property not found.'}</p>
        <p className="text-slate-500 mt-2">Try refreshing the page or returning to the listings.</p>
      </div>
    );
  }

  /* ================================
   * Page
   * ================================ */
  return (
    <div className="flex flex-col md:flex-row px-4 md:px-12 py-6 gap-6">
      {/* ===== Left Column ===== */}
      <main className="md:w-2/3 md:pr-2">
        {/* Title / Image */}
        <h1 className="text-2xl font-bold mb-1">{property.title}</h1>
        <p className="text-gray-500 mb-3">{property.location}</p>

        <img
          src={property.imageurl || '/placeholder.jpg'}
          alt={property.title}
          className="w-full h-64 object-cover rounded-lg mb-4"
          loading="eager"
          onError={(e) => ((e.target as HTMLImageElement).src = '/placeholder.jpg')}
        />

        {/* Investment Summary */}
        <section className="section-box">
          <InvestmentSummary property={property} />

          {/* Link that opens the shared modal in the AI score section */}
          <button
            type="button"
            className="mt-2 text-sm text-gray-600 underline"
            onClick={() => {
              document.getElementById('ai-score-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              triggerAIScoreInfo();
            }}
          >
            ❓ What do these scores mean?
          </button>
        </section>

        {/* AI Deal Score — always visible */}
        <section id="ai-score-section" className="section-box">
          <h3 className="text-lg font-semibold mb-3">
            🧠 AI Deal Score <span className="ml-2 text-xs font-medium text-slate-500 align-middle">beta</span>
          </h3>

          <AIScoreBars
  overall={aiOverall}
  items={aiItems}
  showHeader={false} // hides the second header
  className="mt-4"
/>

          {/* Single shared modal lives here */}
          <AIScoreInfo />
        </section>

        {/* Calculators */}
        <section className="section-box">
          <MortgageCalculator price={property.price} />
        </section>

        <section className="section-box">
          <StampDutyCalculator price={property.price} />
        </section>

        {/* Area Intelligence */}
        <section className="section-box">
          <AreaIntel
            locationLabel={property?.location}
            postcode={postcode}
            data={{
              avgYieldPct: property?.yield_percent,
              avgRent: (property as any)?.avg_rent,
              crimeRateIndex: (property as any)?.crime_index,
              ofstedSummary: (property as any)?.ofsted_summary,
              transportSummary: (property as any)?.transport_summary,
            }}
          />
        </section>

        {/* Investor Notes */}
        <div className="w-full p-4 border rounded-lg bg-white dark:bg-neutral-900">
          <NotesFields propertyId={id ?? ''} />
        </div>
      </main>

      {/* ===== Right Column (sticky) ===== */}
      <aside className="md:w-1/3 md:pl-2 md:sticky md:top-4 self-start">
        {/* Deal Summary */}
        <section className="section-box">
          <h3 className="text-lg font-semibold mb-2">📊 Deal Summary</h3>
          <p>
            <strong>Price:</strong>{' '}
            £{typeof property.price === 'number' ? property.price.toLocaleString() : 'N/A'}
          </p>
        </section>

        <section className="section-box">
          <p><strong>Yield:</strong> {property.yield_percent ?? 'N/A'}%</p>
          <p><strong>ROI:</strong> {property.roi_percent ?? 'N/A'}%</p>
          <p><strong>Property Type:</strong> {property.propertyType || 'N/A'}</p>
          <p><strong>Investment Type:</strong> {property.investmentType || 'N/A'}</p>
          <p><strong>Source:</strong> {property.source || 'N/A'}</p>
        </section>

        {/* Actions */}
<ExportActions
  className="mt-4"
  onSave={() => alert("Saving to Supabase (coming next)…")}
  onPdf={() => alert("Generating PDF v2 (coming next)…")}
  onCrm={() => alert("Sending to CRM (Zapier/Airtable/Pipedrive)…")}
/>

        {/* AI Investment Insights */}
<InvestmentInsights
  className="mt-4"
  price={property.price}
  yield_percent={property.yield_percent}
  roi_percent={property.roi_percent}
  postcode={(property as any)?.postcode ?? (property as any)?.post_code ?? (property as any)?.postal_code}
/>

{/* Quick Comps */}
<CompsMini
  className="mt-4"
  postcode={(property as any)?.postcode ?? (property as any)?.post_code ?? (property as any)?.postal_code}
/>

        {/* Static Map — compact so it doesn’t dominate the sidebar */}
        {hasCoords ? (
          <MapSingle
            property={property}
            height={260}
            zoom={14}
            scrollWheelZoom={false}
            className="mt-8"
          />
        ) : (
          <p className="mt-8 text-gray-500">Map unavailable — no coordinates provided.</p>
        )}
      </aside>

      {/* Floating AI Assistant */}
      <AIChatbot property={property} />
    </div>
  );
}
