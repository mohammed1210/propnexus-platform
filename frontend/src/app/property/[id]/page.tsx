'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@supabase/supabase-js';

// UI helpers
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

// map (dynamic import to avoid SSR crash)
const MapSingle = dynamic(() => import('@/components/property_details/MapSingle'), { ssr: false });

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Property = {
  id: string;
  title: string;
  location: string;
  price: number;
  bedrooms?: number;
  bathrooms?: number;
  yield_percent?: number;
  roi_percent?: number;
  description?: string;
  imageurl?: string;
  latitude?: number | null;
  longitude?: number | null;
  // optional, used by AreaIntel
  avg_rent?: number;
  crime_index?: number;
  ofsted_summary?: string;
  transport_summary?: string;
  // optional, used by insights/exit gen if present
  propertyType?: string;
  investmentType?: string;
};

export default function PropertyDetailsPage() {
  // ── Route param (typed) ─────────────────────────────────────────
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  // ── State ───────────────────────────────────────────────────────
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  // AI Score state (bars want {label,value})
  const [aiOverall, setAiOverall] = useState(0);
  const [aiItems, setAiItems] = useState<{ label: string; value: number }[]>([]);

  // ── Effects ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    fetchProperty(id);
  }, [id]);

  async function fetchProperty(propId: string) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propId)
        .single();

      if (error) {
        console.error('Error fetching property:', error);
        setProperty(null);
        return;
      }

      const p: Property = {
        ...data,
        price: Number(data?.price ?? 0),
        yield_percent: data?.yield_percent != null ? Number(data.yield_percent) : undefined,
        roi_percent: data?.roi_percent != null ? Number(data.roi_percent) : undefined,
        latitude: data?.latitude != null ? Number(data.latitude) : null,
        longitude: data?.longitude != null ? Number(data.longitude) : null,
        propertyType: data?.propertyType ?? data?.property_type,
        investmentType: data?.investmentType ?? data?.investment_type,
      };

      setProperty(p);
      computeAIScore(p);
    } finally {
      setLoading(false);
    }
  }

  function computeAIScore(p: Property) {
    const items: { label: string; value: number }[] = [
      { label: 'Yield', value: Math.max(0, Math.min(100, Math.round((p.yield_percent ?? 0) * 10))) },
      { label: 'ROI', value: Math.max(0, Math.min(100, Math.round((p.roi_percent ?? 0) * 10))) },
      { label: 'Bedrooms', value: Math.max(0, Math.min(100, (p.bedrooms ?? 0) * 20)) },
      { label: 'Bathrooms', value: Math.max(0, Math.min(100, (p.bathrooms ?? 0) * 25)) },
    ];
    setAiItems(items);
    const overall = Math.round(items.reduce((s, it) => s + it.value, 0) / items.length);
    setAiOverall(overall);
  }

  // ── Actions ─────────────────────────────────────────────────────
  async function handleSaveDeal() {
    if (!property) return;
    await supabase.from('saved_deals').insert([{ property_id: property.id }]);
    alert('✅ Deal saved!');
  }

  function handleDownloadPdf() {
    alert('PDF export coming soon!');
  }

  // ── Derived ─────────────────────────────────────────────────────
  if (loading) return <p className="p-6">Loading…</p>;
  if (!property) return <p className="p-6">Property not found.</p>;

  const hasCoords = property.latitude != null && property.longitude != null;
  // super lightweight postcode guess (fine until we wire a dedicated field)
  const postcode = useMemo(() => property.location?.trim().split(/\s+/).slice(-1)[0], [property.location]);

  // ── View ────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* LEFT — Main Content */}
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
            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
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

        {/* Exit Strategy Generator */}
        <Section>
          <SectionTitle icon={<span>💼</span>}>Exit Strategy Suggestions</SectionTitle>
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

        {/* Mortgage */}
        <Section>
          <SectionTitle icon={<span>🏦</span>}>Mortgage & BRRR Calculator</SectionTitle>
          <MortgageCalculator price={property.price} />
        </Section>

        {/* Stamp Duty */}
        <Section>
          <SectionTitle icon={<span>🏛️</span>}>Stamp Duty Calculator</SectionTitle>
          <StampDutyCalculator price={property.price} />
        </Section>

        {/* Area Intelligence */}
        <Section>
          <SectionTitle icon={<span>📍</span>}>Area Intelligence</SectionTitle>
          <AreaIntel
            locationLabel={property.location}
            postcode={postcode}
            data={{
              avgYieldPct: property.yield_percent,
              avgRent: property.avg_rent,
              crimeRateIndex: property.crime_index,
              ofstedSummary: property.ofsted_summary,
              transportSummary: property.transport_summary,
            }}
          />
        </Section>

        {/* Investment Insights */}
        <Section>
          {/* hideTitle prevents a duplicate header inside the component */}
          <InvestmentInsights
            price={property.price}
            yield_percent={property.yield_percent}
            roi_percent={property.roi_percent}
            postcode={postcode}
            aiOverall={aiOverall}
            aiItems={aiItems.map(i => ({ key: i.label.toLowerCase(), label: i.label, value: i.value }))}
            hideTitle
          />
        </Section>

        {/* Notes */}
        <Section>
          <SectionTitle icon={<span>📝</span>}>Investor Notes</SectionTitle>
          <NotesFields propertyId={property.id} />
        </Section>
      </div>

      {/* RIGHT — Sidebar */}
      <aside className="md:col-span-1 space-y-6">
        <Section>
          <SectionTitle icon={<span>⚡</span>}>Quick Actions</SectionTitle>
          <CardActions
            onSave={handleSaveDeal}
            onPdf={handleDownloadPdf}
            onCrm={() => alert('Sending to CRM…')}
          />
        </Section>

        <Section>
          <SectionTitle icon={<span>📊</span>}>Deal Summary</SectionTitle>
          <ul className="space-y-2 text-sm">
            <li>
              <Badge>Price</Badge> £{property.price.toLocaleString()}
            </li>
            <li>
              <Badge>Yield</Badge> {property.yield_percent ?? '—'}%
            </li>
            <li>
              <Badge>ROI</Badge> {property.roi_percent ?? '—'}%
            </li>
            {property.bedrooms != null && (
              <li>
                <Badge>Beds</Badge> {property.bedrooms}
              </li>
            )}
            {property.bathrooms != null && (
              <li>
                <Badge>Baths</Badge> {property.bathrooms}
              </li>
            )}
            {property.propertyType && (
              <li>
                <Badge>Type</Badge> {property.propertyType}
              </li>
            )}
            {property.investmentType && (
              <li>
                <Badge>Strategy</Badge> {property.investmentType}
              </li>
            )}
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
      <AIChatbot property={property} />
    </div>
  );
}
