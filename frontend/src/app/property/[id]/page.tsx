'use client';

/* ──────────────────────────────────────────────────────────────────────────────
   Property Details Page
   - Fetches property by id (works with local API or external BACKEND_BASE)
   - Responsive 2-column layout (stack on mobile)
   - Uses shared UI primitives: Section, SectionTitle, KeyValue, DividerRow,
     CardActions, Badge, and Button
   - Keeps: AI Score, Exit Strategy, Calculators, Area Intel, Notes, Map
   - Single source of “comps/insights” via <InvestmentInsights>
   ────────────────────────────────────────────────────────────────────────────── */

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

import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import KeyValue from '@/components/ui/KeyValue';
import DividerRow from '@/components/ui/DividerRow';
import CardActions from '@/components/ui/CardActions';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

import { Property } from '@/types';

/* ── Page Component ─────────────────────────────────────────────────────────── */
export default function PropertyDetailsPage() {
  /* Routing */
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined);

  /* Config */
  const BACKEND_BASE = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '').trim();

  /* State */
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Fetch property */
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
          yield_percent: Number(raw.yield_percent ?? (raw as any).yield ?? 0),
          roi_percent: Number(raw.roi_percent ?? (raw as any).roi ?? 0),
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

  /* Derived flags */
  const hasCoords = useMemo(
    () => Boolean(property?.latitude != null && property?.longitude != null),
    [property?.latitude, property?.longitude]
  );

  /* AI score (demo calc until backend scoring is wired) */
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

  /* Postcode resolver */
  const postcode: string | undefined =
    (property as any)?.postcode ??
    (property as any)?.post_code ??
    (property as any)?.postal_code ??
    undefined;

  /* Actions */
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

  /* Loading / Error */
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

  /* ── Render ───────────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col md:flex-row px-4 md:px-12 py-6 gap-6">
      {/* ── Left Column ───────────────────────────────────────────── */}
      <main className="md:w-2/3 md:pr-2">

        {/* Header */}
        <header className="mb-3">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{property.title}</h1>
          {property.location ? <p className="text-gray-500 mt-1">{property.location}</p> : null}

          <CardActions className="mt-3">
            <Button variant="secondary" size="sm" onClick={handleSaveDeal}>💾 Save Deal</Button>
            <Button variant="secondary" size="sm" onClick={handleDownloadPdf}>🗂️ Deal Pack (v2)</Button>
            <Button variant="ghost" size="sm" onClick={() => alert('Sending to CRM (Zapier/Airtable/Pipedrive)…')}>
              🔗 Export to CRM
            </Button>
          </CardActions>
        </header>

        {/* Hero image */}
        <img
          src={property.imageurl || '/placeholder.jpg'}
          alt={property.title}
          className="w-full aspect-video object-cover rounded-lg mb-4"
          loading="eager"
          onError={(e) => ((e.target as HTMLImageElement).src = '/placeholder.jpg')}
        />

        {/* Investment Summary */}
        <Section>
          <SectionTitle icon={<span>🧾</span>}>
            Investment Summary
          </SectionTitle>
          <InvestmentSummary property={property} />
          <CardActions>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                document.getElementById('ai-score-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                triggerAIScoreInfo();
              }}
            >
              ❓ What do these scores mean?
            </Button>
          </CardActions>
        </Section>

        {/* Exit Strategy */}
        <Section>
          <SectionTitle icon={<span>💼</span>}>Exit Strategy Suggestions</SectionTitle>
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
        </Section>

        {/* AI Deal Score – explicit title so the badge can sit beside it */}
        <Section id="ai-score-section">
          <SectionTitle
            icon={<span>🧠</span>}
            aside={<Badge variant="info">beta</Badge>}
          >
            AI Deal Score
          </SectionTitle>
          <AIScoreBars overall={aiOverall} items={aiItems} showHeader={false} className="mt-2" />
          <AIScoreInfo />
        </Section>

        {/* Calculators */}
        <Section>
          <SectionTitle icon={<span>🏦</span>}>Mortgage & BRRR Calculator</SectionTitle>
          <MortgageCalculator price={property.price} />
        </Section>

        <Section>
          <SectionTitle icon={<span>🏛️</span>}>Stamp Duty Calculator</SectionTitle>
          <StampDutyCalculator price={property.price} />
        </Section>

        {/* Area Intelligence */}
        <Section>
          <SectionTitle icon={<span>📍</span>}>Area Intelligence</SectionTitle>
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
        </Section>

        {/* Investor Notes */}
        <Section>
          <SectionTitle icon={<span>📝</span>}>Investor Notes</SectionTitle>
          <NotesFields propertyId={id ?? ''} />
        </Section>
      </main>

      {/* ── Right Column ──────────────────────────────────────────── */}
      <aside className="md:w-1/3 md:pl-2 md:sticky md:top-4 self-start space-y-6">

        {/* Deal Summary */}
        <Section>
          <SectionTitle icon={<span>📊</span>}>Deal Summary</SectionTitle>

          <div className="space-y-2">
            <KeyValue label="Price" value={`£${(property.price ?? 0).toLocaleString()}`} />
            <DividerRow />
            <KeyValue label="Yield" value={`${property.yield_percent ?? 'N/A'}%`} />
            <KeyValue label="ROI" value={`${property.roi_percent ?? 'N/A'}%`} />
            <DividerRow />
            <KeyValue label="Property Type" value={property.propertyType || 'N/A'} />
            <KeyValue label="Investment Type" value={property.investmentType || 'N/A'} />
            <KeyValue label="Source" value={property.source || 'N/A'} />
          </div>
        </Section>

        {/* Actions (secondary access) */}
        <Section>
          <SectionTitle icon={<span>⚡</span>}>Quick Actions</SectionTitle>
          <CardActions align="between">
            <Button variant="secondary" onClick={handleSaveDeal}>💾 Save Deal</Button>
            <Button variant="secondary" onClick={handleDownloadPdf}>🗂️ Deal Pack (v2)</Button>
            <Button variant="ghost" onClick={() => alert('Sending to CRM (Zapier/Airtable/Pipedrive)…')}>
              🔗 Export to CRM
            </Button>
          </CardActions>
        </Section>

        {/* AI Investment Insights */}
        <Section>
          <SectionTitle icon={<span>💡</span>}>Investment Insights</SectionTitle>
          <InvestmentInsights
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
            <MapSingle property={property} height={260} zoom={14} scrollWheelZoom={false} />
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