'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import nextDynamic from 'next/dynamic';

// Types-only shim so Codespaces/TS won't complain if @types/node isn't installed.
declare const process: { env?: Record<string, string | undefined> };

// UI
import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import CardActions from '@/components/ui/CardActions';
import Badge from '@/components/ui/Badge';

// Property detail components
import MortgageCalculator from '@/components/property_details/MortgageCalculator';
import StampDutyCalculator from '@/components/property_details/StampDutyCalculator';
import AreaIntel from '@/components/property_details/AreaIntel';
import NotesFields from '@/components/property_details/NotesFields';
import InvestmentInsights from '@/components/property_details/InvestmentInsights';
import AIScoreBars from '@/components/property_details/AIScoreBars';
import AIScoreInfo from '@/components/property_details/AIScoreInfo';
import ExitStrategyGenerator from '@/components/property_details/ExitStrategyGenerator';
import AIChatbot from '@/components/property_details/AIChatbot';

const MapSingle = nextDynamic(() => import('@/components/property_details/MapSingle'), { ssr: false });

type Property = {
  id: string; // id only
  title: string;
  location: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  yield_percent: number | null;
  roi_percent: number | null;
  description?: string | null;
  imageurl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  avg_rent?: number | null;
  crime_index?: number | null;
  ofsted_summary?: string | null;
  transport_summary?: string | null;
  propertyType?: string | null;
  investmentType?: string | null;
};

/** Safe helper for reading/normalizing the backend base URL */
function getBackendBase(): string {
  const raw = (process?.env?.NEXT_PUBLIC_BACKEND_URL ?? '') as string;
  if (!raw) {
    throw new Error('NEXT_PUBLIC_BACKEND_URL is not set');
  }
  return raw.replace(/\/+$/, ''); // strip trailing slash(es)
}

export default function PropertyDetailsPage() {
  const params = useParams<{ id: string }>();
  // normalize id just in case
  const id = (params?.id ?? '') as string;

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  const [aiOverall, setAiOverall] = useState(0);
  const [aiItems, setAiItems] = useState<{ label: string; value: number }[]>([]);

  const fetchProperty = useCallback(async (propId: string) => {
    setLoading(true);
    try {
      const base = getBackendBase();
      const url = `${base}/api/properties/${encodeURIComponent(propId)}`;

      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) {
        console.error('Property fetch failed', resp.status, await resp.text());
        setProperty(null);
      } else {
        const data = (await resp.json()) as Property;
        setProperty(data);
        computeAIScore(data);
      }
    } catch (e) {
      console.error('Error fetching property:', e);
      setProperty(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) fetchProperty(id);
  }, [id, fetchProperty]);

  function computeAIScore(p: Property) {
    const items = [
      { label: 'Yield', value: Math.min(100, Number(p.yield_percent ?? 0) * 10) },
      { label: 'ROI', value: Math.min(100, Number(p.roi_percent ?? 0) * 10) },
      { label: 'Bedrooms', value: Math.min(100, Number(p.bedrooms ?? 0) * 20) },
      { label: 'Bathrooms', value: Math.min(100, Number(p.bathrooms ?? 0) * 25) },
    ];
    setAiItems(items);
    setAiOverall(Math.round(items.reduce((s, i) => s + i.value, 0) / items.length));
  }

  async function handleSaveDeal() {
    if (!property) return;
    try {
      const base = getBackendBase();
      // Adjust endpoint when your backend route is ready
      const resp = await fetch(`${base}/api/saved-deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: property.id, user_id: 'demo-user' }),
      });
      if (!resp.ok) throw new Error(`Save failed: ${resp.status}`);
      alert('Deal saved!');
    } catch (e) {
      console.error(e);
      alert('Could not save this deal.');
    }
  }

  function handleDownloadPdf() {
    alert('Export to PDF coming soon!');
  }

  const hasCoords = useMemo(() => {
    return (
      property?.latitude != null &&
      property?.longitude != null &&
      Number.isFinite(property.latitude) &&
      Number.isFinite(property.longitude)
    );
  }, [property]);

  const postcode = useMemo(() => property?.location?.trim().split(/\s+/).pop(), [property]);

  if (loading) return <p className="p-6">Loading…</p>;
  if (!property) {
    return (
      <div className="p-6">
        <p>Property not found.</p>
        <a href="/" className="text-blue-600 underline">← Back to dashboard</a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* LEFT */}
      <div className="md:col-span-2 space-y-6">
        {/* Header */}
        <header className="mb-4 md:mb-6">
          <h1 className="text-[clamp(1.5rem,4vw,2.25rem)] font-extrabold leading-tight text-balance">
            {property.title}
          </h1>
          <p className="text-slate-600 mt-1">{property.location}</p>

          <div className="mt-3">
            <CardActions
              onSave={handleSaveDeal}
              onPdf={handleDownloadPdf}
              onCrm={() => alert('Sending to CRM…')}
            />
          </div>
        </header>

        {/* Hero Image */}
        {property.imageurl && (
          // Replace with next/image to silence Next's <img> warning if desired
          <img
            src={property.imageurl}
            alt={property.title}
            className="w-full h-72 md:h-96 object-cover rounded-xl shadow-sm"
          />
        )}

        {/* Overview */}
        {property.description && (
          <Section>
            <SectionTitle icon={<span>📋</span>}>Overview</SectionTitle>
            <p className="text-slate-700 whitespace-pre-line leading-relaxed">
              {property.description}
            </p>
          </Section>
        )}

        {/* AI Deal Score */}
        <Section id="ai-score-section">
          <SectionTitle icon={<span>🧠</span>}>
            AI Deal Score <span className="ml-2 text-xs font-medium text-slate-500">beta</span>
          </SectionTitle>
          <AIScoreBars overall={aiOverall} items={aiItems} showHeader={false} className="mt-3" />
          <div className="mt-3">
            <AIScoreInfo />
          </div>
        </Section>

        {/* Exit Strategies */}
        <Section>
          <SectionTitle icon={<span>🚪</span>}>Exit Strategies</SectionTitle>
          <ExitStrategyGenerator
            title={property.title}
            location={property.location}
            price={Number(property.price)}
            yield_percent={Number(property.yield_percent ?? 0)}
            roi_percent={Number(property.roi_percent ?? 0)}
            propertyType={property.propertyType ?? ''}
            investmentType={property.investmentType ?? ''}
            description={property.description ?? ''}
          />
        </Section>

        {/* Mortgage */}
        <Section>
          <SectionTitle icon={<span>🏦</span>}>Mortgage</SectionTitle>
          <MortgageCalculator price={Number(property.price)} />
        </Section>

        {/* Stamp Duty */}
        <Section>
          <SectionTitle icon={<span>🧾</span>}>Stamp Duty</SectionTitle>
          <StampDutyCalculator price={Number(property.price)} />
        </Section>

        {/* Area Intelligence */}
        <Section>
          <SectionTitle icon={<span>🗺️</span>}>Area Intelligence</SectionTitle>
          <AreaIntel
            locationLabel={property.location}
            postcode={postcode}
            data={{
              avgYieldPct: property.yield_percent ?? undefined,
              avgRent: property.avg_rent ?? undefined,
              crimeRateIndex: property.crime_index ?? undefined,
              ofstedSummary: property.ofsted_summary ?? undefined,
              transportSummary: property.transport_summary ?? undefined,
            }}
          />
        </Section>

        {/* Investment Insights */}
        <Section>
          <InvestmentInsights
            price={Number(property.price)}
            yield_percent={property.yield_percent ?? undefined}
            roi_percent={property.roi_percent ?? undefined}
            postcode={postcode}
            aiOverall={aiOverall}
            aiItems={aiItems}
            hideTitle
          />
        </Section>

        {/* Notes */}
        <Section>
          <SectionTitle icon={<span>📝</span>}>Notes</SectionTitle>
          <NotesFields propertyId={property.id} />
        </Section>
      </div>

      {/* RIGHT — Sidebar */}
      <aside className="md:col-span-1 space-y-6">
        <Section>
          <SectionTitle icon={<span>📊</span>}>Deal Summary</SectionTitle>
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

        <Section>
          <SectionTitle icon={<span>🗺️</span>}>Location</SectionTitle>
          {hasCoords ? (
            <MapSingle property={property} height={260} zoom={14} scrollWheelZoom={false} />
          ) : (
            <p className="text-gray-500">Map unavailable — no coordinates provided.</p>
          )}
        </Section>
      </aside>

      {/* Floating Chatbot */}
      <AIChatbot property={property as any} />
    </div>
  );
}