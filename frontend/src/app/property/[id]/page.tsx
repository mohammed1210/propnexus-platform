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
import InvestmentInsights from '@details/InvestmentInsights';
import ExportActions from '@details/ExportActions';

import { Property } from '@/types';

export default function PropertyDetailsPage() {
  // -----------------------------
  // Routing / params
  // -----------------------------
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined);

  // -----------------------------
  // Environment
  // -----------------------------
  const BACKEND_BASE = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '').trim();

  // -----------------------------
  // State
  // -----------------------------
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // -----------------------------
  // Data fetch
  // -----------------------------
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

  // -----------------------------
  // Derived
  // -----------------------------
  const hasCoords = useMemo(
    () => Boolean(property?.latitude != null && property?.longitude != null),
    [property?.latitude, property?.longitude]
  );

  // AI score (demo calc until backend scoring is wired)
  const aiOverall: number =
    typeof (property as any)?.ai_score === 'number'
      ? (property as any).ai_score
      : Math.round(
          [
            Math.min(100, Math.max(0, Math.round((property?.yield_percent ?? 0) * 10))),
            Math.min(100, Math.max(0, Math.round((property?.roi_percent ?? 0) * 5))),
            68, // area demand (illustrative)
            60, // risk adjusted (illustrative)
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
    { key: 'demand', label: 'Area Demand', value: 68, hint: 'Rental demand and stock turnover (illustrative).' },
    { key: 'risk', label: 'Risk Adjusted', value: 60, hint: 'Lower risk → higher score (illustrative).' },
  ];

  // Postcode resolver
  const postcode: string | undefined =
    (property as any)?.postcode ??
    (property as any)?.post_code ??
    (property as any)?.postal_code ??
    undefined;

  // -----------------------------
  // Actions
  // -----------------------------
  async function handleSaveDeal() {
    try {
      if (!property || !id) return;

      const pc =
        (property as any)?.postcode ??
        (property as any)?.post_code ??
        (property as any)?.postal_code ??
        null;

      const res = await fetch('/api/save-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: id,
          title: property.title,
          location: property.location,
          postcode: pc,
          price: property.price,
          yield_percent: property.yield_percent,
          roi_percent: property.roi_percent,
          source: property.source,
          notes: { ai_overall: (property as any)?.ai_score ?? aiOverall, ai_items: aiItems },
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      alert('✅ Deal saved to Supabase');
    } catch (err: any) {
      console.error(err);
      alert(`❌ Save failed: ${err.message || err}`);
    }
  }

  async function handleDownloadPdf() {
    try {
      if (!property) return;

      const pc =
        (property as any)?.postcode ??
        (property as any)?.post_code ??
        (property as any)?.postal_code ??
        null;

      const res = await fetch('/api/deal-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: property.title,
          location: property.location,
          postcode: pc,
          price: property.price,
          yield_percent: property.yield_percent,
          roi_percent: property.roi_percent,
          ai_overall: (property as any)?.ai_score ?? aiOverall,
          ai_items: [
            { label: 'Yield Strength', value: Math.min(100, Math.max(0, Math.round((property?.yield_percent ?? 0) * 10))) },
            { label: 'ROI Potential', value: Math.min(100, Math.max(0, Math.round((property?.roi_percent ?? 0) * 5))) },
            { label: 'Area Demand', value: 68 },
            { label: 'Risk Adjusted', value: 60 },
          ],
        }),
      });

      if (!res.ok) throw new Error('PDF failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'propnexus-deal-pack.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Could not generate PDF. Please try again.');
    }
  }

  // -----------------------------
  // Loading / Error
  // -----------------------------
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6" aria-busy="true" aria-live="polite">
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
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 text-center">
        <p className="text-red-600 font-medium">{error ?? 'Property not found.'}</p>
        <p className="text-slate-500 mt-2">Try refreshing the page or returning to the listings.</p>
      </div>
    );
  }

  // -----------------------------
  // Page
  // -----------------------------
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 flex flex-col md:flex-row gap-6">
      {/* ===== Left Column ===== */}
      <main className="md:w-2/3 md:pr-2">
        {/* Header */}
        <header className="mb-3">
          <h1 className="text-3xl font-bold tracking-tight">{property.title}</h1>
          <p className="text-neutral-500">{property.location}</p>

          {/* quick price line (optional; sidebar has full summary) */}
          <p className="mt-1 text-lg font-semibold">£{typeof property.price === 'number' ? property.price.toLocaleString() : 'N/A'}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800 text-sm"
              onClick={handleSaveDeal}
            >
              💾 Save Deal
            </button>
            <button
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800 text-sm"
              onClick={handleDownloadPdf}
            >
              🗂️ Deal Pack (v2)
            </button>
            <button
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800 text-sm"
              onClick={() => alert('Sending to CRM (Zapier/Airtable/Pipedrive)…')}
            >
              🔗 Export to CRM
            </button>
          </div>
        </header>

        {/* Hero image */}
        <img
          src={property.imageurl || '/placeholder.jpg'}
          alt={property.title}
          className="w-full aspect-video object-cover rounded-lg mb-4"
          loading="eager"
          onError={(e) => ((e.target as HTMLImageElement).src = '/placeholder.jpg')}
        />

        {/* Investment Summary (component owns its heading) */}
        <section className="section-box mb-6">
          <InvestmentSummary property={property} />
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

        {/* Exit Strategy */}
        <section className="section-box mb-6">
          <details open>
            <summary className="cursor-pointer select-none text-lg font-semibold mb-2 list-none">
              <span className="inline-block align-middle mr-1">💼</span> Exit Strategy Suggestions
            </summary>
            <p className="text-slate-600 mb-3">Use AI to suggest smart exit plans tailored to this property.</p>
            <ExitStrategyGenerator
              title={property.title}
              location={property.location}
              price={property.price}
              yield_percent={property.yield_percent}
              roi_percent={property.roi_percent}
              propertyType={property.propertyType}
              investmentType={property.investmentType}
              description={property.description}
            />
          </details>
        </section>

                {/* AI Deal Score */}
        <section id="ai-score-section" className="section-box mb-6">
          <h3 className="text-lg font-semibold mb-3">
            🧠 AI Deal Score <span className="ml-2 text-xs font-medium text-slate-500 align-middle">beta</span>
          </h3>
          <AIScoreBars overall={aiOverall} items={aiItems} showHeader={false} className="mt-4" />
          <AIScoreInfo />
        </section>

        {/* Calculators */}
        <section className="section-box mb-6">
          <h3 className="text-lg font-semibold mb-2">🏦 Mortgage & BRRR Calculator</h3>
          <MortgageCalculator price={property.price} />
        </section>

        <section className="section-box mb-6">
          <h3 className="text-lg font-semibold mb-2">🏛️ Stamp Duty Calculator</h3>
          <StampDutyCalculator price={property.price} />
        </section>

        {/* Area Intelligence */}
        <section className="section-box mb-6">
          <h3 className="text-lg font-semibold mb-2">📍 Area Intelligence</h3>
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
        <section className="section-box">
          <h3 className="text-lg font-semibold mb-2">📝 Investor Notes</h3>
          <NotesFields propertyId={id ?? ''} />
        </section>
      </main>

      {/* ===== Right Column (sticky) ===== */}
      <aside className="md:w-1/3 md:pl-2 md:sticky md:top-4 self-start">
        {/* Deal Summary */}
        <section className="section-box mb-6">
          <h3 className="text-lg font-semibold mb-2">📊 Deal Summary</h3>
          <dl className="mt-1 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-500">Price</dt>
              <dd className="font-medium">£{typeof property.price === 'number' ? property.price.toLocaleString() : 'N/A'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Yield</dt>
              <dd className="font-medium">{property.yield_percent ?? 'N/A'}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">ROI</dt>
              <dd className="font-medium">{property.roi_percent ?? 'N/A'}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Property Type</dt>
              <dd className="font-medium">{property.propertyType || 'N/A'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Investment Type</dt>
              <dd className="font-medium">{property.investmentType || 'N/A'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Source</dt>
              <dd className="font-medium">{property.source || 'N/A'}</dd>
            </div>
          </dl>
        </section>

        {/* Quick Actions */}
        <section className="section-box mb-6">
          <ExportActions
            onSave={handleSaveDeal}
            onPdf={handleDownloadPdf}
            onCrm={() => alert('Sending to CRM (Zapier/Airtable/Pipedrive)…')}
          />
        </section>

        {/* Investment Insights (with AI breakdown enabled) */}
        <section className="section-box mb-6">
          <InvestmentInsights
            price={property.price}
            yield_percent={property.yield_percent}
            roi_percent={property.roi_percent}
            postcode={(property as any)?.postcode ?? (property as any)?.post_code ?? (property as any)?.postal_code}
            aiOverall={aiOverall}
            aiItems={aiItems}
          />
        </section>

        {/* Map / Location */}
        <section className="section-box">
          <h3 className="text-lg font-semibold mb-2">🗺️ Location</h3>
          {hasCoords ? (
            <MapSingle property={property} height={260} zoom={14} scrollWheelZoom={false} />
          ) : (
            <p className="text-gray-500">Map unavailable — no coordinates provided.</p>
          )}
        </section>
      </aside>

      {/* Floating AI Assistant */}
      <AIChatbot property={property} />
    </div>
  );
}
