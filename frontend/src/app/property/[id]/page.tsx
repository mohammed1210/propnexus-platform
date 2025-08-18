'use client';

/* =========================================================
   Property details page (polished)
   - Two-column layout (sticky right sidebar on desktop)
   - Consistent card styling & section spacing
   - Action buttons in header + compact mobile action bar
   ========================================================= */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import Button from '@/components/ui/Button';

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

import type { Property } from '@/types';

/* ---------- Convenience UI wrappers ---------- */

function SectionCard(props: React.PropsWithChildren<{ className?: string; id?: string; title?: string; icon?: string }>) {
  const { className = '', id, title, icon, children } = props;
  return (
    <section
      id={id}
      className={[
        'rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900',
        'p-4 md:p-5 shadow-sm',
        className,
      ].join(' ')}
    >
      {title ? (
        <h3 className="text-lg font-semibold mb-3">
          {icon ? <span className="inline-block mr-2">{icon}</span> : null}
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

function KeyRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm py-1">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/* =========================================================
   Component
   ========================================================= */

export default function PropertyDetailsPage() {
  // ----- Routing & env
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined);
  const BACKEND_BASE = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '').trim();

  // ----- State
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ----- Fetch property
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

  // ----- Derived
  const hasCoords = useMemo(
    () => Boolean(property?.latitude != null && property?.longitude != null),
    [property?.latitude, property?.longitude]
  );

  // AI score (still demo until backend scoring is wired)
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
    { key: 'yield', label: 'Yield Strength', value: Math.min(100, Math.max(0, Math.round((property?.yield_percent ?? 0) * 10))), hint: 'Estimated gross yield vs local averages.' },
    { key: 'roi', label: 'ROI Potential', value: Math.min(100, Math.max(0, Math.round((property?.roi_percent ?? 0) * 5))), hint: 'Projected ROI given refurb & exit assumptions.' },
    { key: 'demand', label: 'Area Demand', value: 68, hint: 'Rental demand and stock turnover (illustrative).' },
    { key: 'risk', label: 'Risk Adjusted', value: 60, hint: 'Lower risk → higher score (illustrative).' },
  ];

  // Postcode
  const postcode: string | undefined =
    (property as any)?.postcode ??
    (property as any)?.post_code ??
    (property as any)?.postal_code ??
    undefined;

  // ----- Actions
  async function handleSaveDeal() {
    try {
      if (!property || !id) return;
      const pc = postcode ?? null;

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
      const pc = postcode ?? null;

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

  /* ---------- Loading / Error states ---------- */

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

  /* ---------- Page layout ---------- */

  return (
    <div className="flex flex-col md:flex-row px-4 md:px-12 py-6 gap-6">
      {/* ===== Left column ===== */}
      <main className="md:w-2/3 md:pr-2">
        {/* Header */}
        <header className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold leading-tight">{property.title}</h1>
              <p className="text-gray-500">{property.location}</p>
              {postcode ? <p className="text-gray-400 text-sm mt-0.5">{postcode}</p> : null}
            </div>
            {/* Price top-right on wide screens */}
            <div className="hidden md:block text-right">
              <div className="text-sm text-slate-500">Price</div>
              <div className="text-2xl font-semibold">£{(property.price ?? 0).toLocaleString()}</div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={handleSaveDeal} variant="primary" size="md" leadingIcon="💾">
              Save Deal
            </Button>
            <Button onClick={handleDownloadPdf} variant="secondary" size="md" leadingIcon="📑">
              Deal Pack (v2)
            </Button>
            <Button
              onClick={() => alert('Sending to CRM (Zapier/Airtable/Pipedrive)…')}
              variant="ghost"
              size="md"
              leadingIcon="🔗"
            >
              Export to CRM
            </Button>
          </div>
        </header>

        {/* Hero image */}
        <img
          src={property.imageurl || '/placeholder.jpg'}
          alt={property.title}
          className="w-full aspect-video object-cover rounded-lg mb-5"
          loading="eager"
          onError={(e) => ((e.target as HTMLImageElement).src = '/placeholder.jpg')}
        />

        {/* Investment Summary */}
        <SectionCard title="Investment Summary" icon="🧾">
          <InvestmentSummary property={property} />
          <button
            type="button"
            className="mt-2 text-sm text-gray-600 underline"
            onClick={() => {
              document.getElementById('ai-score-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              triggerAIScoreInfo();
            }}
          >
            What do these scores mean?
          </button>
        </SectionCard>

        {/* Exit Strategy */}
        <SectionCard title="Exit Strategy Suggestions" icon="💼" className="mt-6">
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
        </SectionCard>

        {/* AI Deal Score */}
        <SectionCard id="ai-score-section" title="AI Deal Score" icon="🧠" className="mt-6">
          <div className="mb-2">
            <span className="ml-1 text-xs font-medium text-slate-500 align-middle">beta</span>
          </div>
          <AIScoreBars overall={aiOverall} items={aiItems} showHeader={false} className="mt-1" />
          <AIScoreInfo />
        </SectionCard>

        {/* Calculators */}
        <SectionCard title="Mortgage & BRRR Calculator" icon="🏦" className="mt-6">
          <MortgageCalculator price={property.price} />
        </SectionCard>

        <SectionCard title="Stamp Duty Calculator" icon="🧮" className="mt-6">
          <StampDutyCalculator price={property.price} />
        </SectionCard>

        {/* Area Intelligence */}
        <SectionCard title="Area Intelligence" icon="📍" className="mt-6">
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
        </SectionCard>

        {/* Notes */}
        <SectionCard title="Investor Notes" icon="📝" className="mt-6">
          <NotesFields propertyId={id ?? ''} />
        </SectionCard>
      </main>

      {/* ===== Right column (sticky) ===== */}
      <aside className="md:w-1/3 md:pl-2 md:sticky md:top-4 self-start">
        {/* Deal Summary */}
        <SectionCard title="Deal Summary" icon="📊">
          <KeyRow label="Price" value={`£${(property.price ?? 0).toLocaleString()}`} />
          <KeyRow label="Yield" value={`${property.yield_percent ?? 'N/A'}%`} />
          <KeyRow label="ROI" value={`${property.roi_percent ?? 'N/A'}%`} />
          <KeyRow label="Property Type" value={property.propertyType || 'N/A'} />
          <KeyRow label="Investment Type" value={property.investmentType || 'N/A'} />
          <KeyRow label="Source" value={property.source || 'N/A'} />
        </SectionCard>

        {/* Insights card */}
        <SectionCard title="Investment Insights" icon="💡" className="mt-6">
          <InvestmentInsights
            price={property.price}
            yield_percent={property.yield_percent}
            roi_percent={property.roi_percent}
            postcode={postcode}
            aiOverall={aiOverall}
            aiItems={aiItems}
          />
        </SectionCard>

        {/* Map */}
        <SectionCard title="Location" icon="🗺️" className="mt-6">
          {hasCoords ? (
            <MapSingle property={property} height={260} zoom={14} scrollWheelZoom={false} />
          ) : (
            <p className="text-gray-500">Map unavailable — no coordinates provided.</p>
          )}
        </SectionCard>
      </aside>

      {/* Floating AI Assistant */}
      <AIChatbot property={property} />

      {/* Mobile action bar */}
      <div className="fixed md:hidden bottom-3 left-0 right-0 px-3">
        <div className="mx-auto max-w-[720px] bg-white/90 dark:bg-neutral-900/90 backdrop-blur rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-lg p-2 flex items-center justify-between gap-2">
          <Button onClick={handleSaveDeal} variant="primary" size="sm" leadingIcon="💾">
            Save
          </Button>
          <Button onClick={handleDownloadPdf} variant="secondary" size="sm" leadingIcon="📑">
            Deal Pack
          </Button>
          <Button
            onClick={() => alert('Sending to CRM (Zapier/Airtable/Pipedrive)…')}
            variant="ghost"
            size="sm"
            leadingIcon="🔗"
          >
            Export
          </Button>
        </div>
      </div>
    </div>
  );
}