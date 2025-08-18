// /src/app/property/[id]/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
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

import type { Property } from '@/types';

/* ──────────────────────────────────────────────────────────────────
   Local UI helpers (inline so you don't need extra files)
   ────────────────────────────────────────────────────────────────── */
function Section({
  children,
  className = '',
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={`rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

function SectionTitle({
  icon,
  children,
  aside,
  className = '',
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-3 flex items-center justify-between ${className}`}>
      <h3 className="text-lg font-semibold flex items-center gap-2 tracking-tight">
        {icon ? <span className="inline-block">{icon}</span> : null}
        <span>{children}</span>
      </h3>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}

function KeyValue({
  label,
  value,
  className = '',
}: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-12 items-baseline gap-3 ${className}`}>
      <div className="col-span-5 text-slate-500">{label}</div>
      <div className="col-span-7 font-medium">{value}</div>
    </div>
  );
}

function DividerRow() {
  return <div className="my-3 h-px bg-neutral-200 dark:bg-neutral-800" />;
}

/* ──────────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────────── */
export default function PropertyDetailsPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined);

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

  // ----- AI score (demo calc until backend scoring is wired)
  const aiOverall: number =
    typeof (property as any)?.ai_score === 'number'
      ? (property as any).ai_score
      : Math.round(
          [
            Math.min(100, Math.max(0, Math.round((property?.yield_percent ?? 0) * 10))),
            Math.min(100, Math.max(0, Math.round((property?.roi_percent ?? 0) * 5))),
            68,
            60,
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

  // ----- Postcode resolver
  const postcode: string | undefined =
    (property as any)?.postcode ??
    (property as any)?.post_code ??
    (property as any)?.postal_code ??
    undefined;

  // ----- Save Deal → /api/save-deal → Supabase
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

  // ----- Deal Pack (PDF v2) → /api/deal-pack
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

  // ----- Loading / error
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

  // ----- Page
  return (
    <div className="flex flex-col md:flex-row px-4 md:px-12 py-6 gap-6">
      {/* ===== Left Column ===== */}
      <main className="md:w-2/3 md:pr-2 space-y-6">
        {/* Header */}
        <header className="mb-1">
          <h1 className="text-2xl md:text-3xl font-bold leading-tight tracking-tight">{property.title}</h1>
          <div className="mt-1 text-slate-500">{property.location}</div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md border border-neutral-300 dark:border-neutral-700 px-2.5 py-1 text-sm bg-white dark:bg-neutral-900">
              £{property.price.toLocaleString()}
            </span>

            <div className="flex flex-wrap gap-2">
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
          </div>
        </header>

        {/* Hero image */}
        <img
          src={property.imageurl || '/placeholder.jpg'}
          alt={property.title}
          className="w-full aspect-video object-cover rounded-lg"
          loading="eager"
          onError={(e) => ((e.target as HTMLImageElement).src = '/placeholder.jpg')}
        />

        {/* Investment Summary (component already renders its own title) */}
        <Section>
          <div className="leading-[1.35] text-[15px] text-neutral-800 dark:text-neutral-200">
            <InvestmentSummary property={property} />
          </div>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 underline"
            onClick={() => {
              document.getElementById('ai-score-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              triggerAIScoreInfo();
            }}
          >
            ❓ What do these scores mean?
          </button>
        </Section>

        {/* Exit Strategy (component already renders its own title) */}
        <Section>
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
        </Section>

        {/* AI Deal Score — with explicit title */}
        <Section id="ai-score-section">
          <SectionTitle icon={<span>🧠</span>}>
            AI Deal Score <span className="ml-2 text-xs font-medium text-slate-500 align-middle">beta</span>
          </SectionTitle>
          <AIScoreBars overall={aiOverall} items={aiItems} showHeader={false} className="mt-2" />
          <AIScoreInfo />
        </Section>

        {/* Calculators (components already print headers) */}
        <Section>
          <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900/40 p-3">
            <MortgageCalculator price={property.price} />
          </div>
        </Section>

        <Section>
          <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900/40 p-3">
            <StampDutyCalculator price={property.price} />
          </div>
        </Section>

        {/* Area Intelligence (avoid duplicate internal title) */}
        <Section>
          <AreaIntel
            // If AreaIntel supports it later: showTitle={false}
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
        </Section>

        {/* Investor Notes */}
        <Section>
          <NotesFields propertyId={id ?? ''} />
        </Section>
      </main>

      {/* ===== Right Column (sticky) ===== */}
      <aside className="md:w-1/3 md:pl-2 md:sticky md:top-4 self-start space-y-6">
        {/* Deal Summary */}
        <Section>
          <SectionTitle icon={<span>📊</span>}>Deal Summary</SectionTitle>
          <div className="space-y-2.5">
            <KeyValue label="Price" value={`£${property.price.toLocaleString()}`} />
            <KeyValue label="Yield" value={`${property.yield_percent ?? 'N/A'}%`} />
            <KeyValue label="ROI" value={`${property.roi_percent ?? 'N/A'}%`} />
            <DividerRow />
            <KeyValue label="Property Type" value={property.propertyType || 'N/A'} />
            <KeyValue label="Investment Type" value={property.investmentType || 'N/A'} />
            <KeyValue label="Source" value={property.source || 'N/A'} />
          </div>
        </Section>

        {/* Actions */}
        <Section>
          <ExportActions
            onSave={handleSaveDeal}
            onPdf={handleDownloadPdf}
            onCrm={() => alert('Sending to CRM (Zapier/Airtable/Pipedrive)…')}
          />
        </Section>

        {/* Investment Insights (keeps its own internal header) */}
        <Section>
          <InvestmentInsights
            className="mt-1"
            price={property.price}
            yield_percent={property.yield_percent}
            roi_percent={property.roi_percent}
            postcode={(property as any)?.postcode ?? (property as any)?.post_code ?? (property as any)?.postal_code}
            aiOverall={aiOverall}
            aiItems={aiItems}
          />
        </Section>

        {/* Static Map */}
        <Section>
          <SectionTitle icon={<span>🗺️</span>}>Location</SectionTitle>
          {hasCoords ? (
            <MapSingle property={property} height={260} zoom={14} scrollWheelZoom={false} className="rounded-md overflow-hidden" />
          ) : (
            <p className="text-gray-500">Map unavailable — no coordinates provided.</p>
          )}
        </Section>
      </aside>

      {/* Floating AI Assistant */}
      <AIChatbot property={property} />
    </div>
  );
}