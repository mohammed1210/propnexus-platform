'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  FiDollarSign,
  FiTool,
  FiFileText,
  FiBarChart2,
  FiEdit3,
  FiMap,
} from 'react-icons/fi';

import QuickStatsActions from '@/components/property_details/QuickStatsActions';
import InvestmentSummary from '@/components/property_details/InvestmentSummary';
import ExitStrategyGenerator from '@/components/property_details/ExitStrategyGenerator';
import DealScore from '@/components/property_details/DealScore';
import AreaInsights from '@/components/property_details/AreaInsights';
import GatedPanel from '@/components/property_details/GatedPanel';
import InvestmentCalculator from '@/components/property_details/InvestmentCalculator';
import CollapsibleCard from '@/components/property_details/CollapsibleCard';
import ImageGallery from '@/components/property_details/ImageGallery';
import PropertyHeader from '@/components/property_details/PropertyHeader';
import PropertyDescription from '@/components/property_details/PropertyDescription';
import WhySurfaced from '@/components/property_details/WhySurfaced';
import TradesmenList from '@/components/tradesmen/TradesmenList';

import type { Property } from '@/types';
import { FF } from '@/lib/flags';
import { buildVerdict, verdictToneClasses } from '@/lib/verdict';
import {
  getRoiDisplay,
  getRoiProxyValidationNote,
  getYieldPercent,
  normalizeProperty,
} from '@/lib/normalizeProperty';
import { buildInvestmentDescription } from '@/lib/propertyDescription';

/** ---- Client-only widgets (no SSR) ---- */
const NotesFields = dynamic(
  () => import('@/components/property_details/NotesFields'),
  { ssr: false }
);

const AIChatbot = dynamic(
  () => import('@/components/property_details/AIChatbot'),
  { ssr: false }
);

const MapSingle = dynamic(
  () => import('@/components/property_details/MapSingle'),
  { ssr: false }
);

/** ------------------------------------- */

type LooseProperty = Partial<Property> & {
  latitude?: number | null;
  longitude?: number | null;
  imageurl?: string | null;
  image_urls?: unknown;
  property_type?: string | null;
  estimated_value?: number | null;
  asking_price?: number | null;
  discount_percent?: number | null;
  discount_estimate_pct?: number | null;
  monthly_rent?: number | null;
  rent_pcm?: number | null;
  rent_per_month?: number | null;
  rent?: number | null;
  source_url?: string | null;
  listing_url?: string | null;
  property_url?: string | null;
  external_url?: string | null;
  original_url?: string | null;
  original_listing_url?: string | null;
  rightmove_url?: string | null;
  zoopla_url?: string | null;
  onthemarket_url?: string | null;
  agent_name?: string | null;
  agency_name?: string | null;
  branch_name?: string | null;
  agent_phone?: string | null;
  contact_phone?: string | null;
  agent_email?: string | null;
  contact_email?: string | null;
  deal_status?: string | null;
  contacted_at?: string | null;
  last_action_at?: string | null;
  action_notes?: string | null;
  top_deal_score?: number | null;
  top_deal_tier?: string | null;
  top_deal_reasons?: string[] | null;
  top_deal?: { score?: number | null; tier?: string | null; reasons?: string[] | null; evidence?: Record<string, unknown> | null } | null;
  data?: { top_deal?: { score?: number | null; tier?: string | null; reasons?: string[] | null; evidence?: Record<string, unknown> | null } | null } | null;
};

const toNum = (v: unknown) =>
  typeof v === 'number' ? v : v == null || v === '' ? undefined : Number(v);

const investmentFitLabel = (investmentType?: unknown, propertyType?: unknown): string => {
  const raw = String(investmentType || propertyType || '').trim();
  if (!raw) return 'Cautious review';
  const hay = raw.toLowerCase();
  if (/hmo|house in multiple/.test(hay)) return 'HMO';
  if (/flip|refurb|auction|below market|bmv/.test(hay)) return 'Flip';
  if (/develop|land|conversion/.test(hay)) return 'Development';
  if (/hybrid|brr|brrr|refinance/.test(hay)) return 'Hybrid';
  if (/btl|buy.?to.?let|rental|rent|flat|apartment|house|terrace|detached|semi/.test(hay)) return 'BTL';
  return raw.length > 18 ? `${raw.slice(0, 17).trim()}…` : raw;
};

export default function PropertyDetailsPage() {
  const { id } = useParams() as { id: string };
  const [property, setProperty] = useState<LooseProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTradeType, setSelectedTradeType] = useState<string>('');

  const PLACEHOLDER_IMG = '/placeholder.jpg';

  const imageUrls = useMemo((): string[] => {
    const raw = (property as any)?.image_urls ?? (property as any)?.imageUrls;
    if (Array.isArray(raw)) {
      return raw.filter((u) => typeof u === 'string' && u.trim()).map((u) => u.trim());
    }
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((u) => typeof u === 'string' && u.trim())
            .map((u) => u.trim());
        }
      } catch {
        // ignore
      }
    }
    return [];
  }, [property]);

  const fallbackImageUrl =
    typeof property?.imageurl === "string" && property.imageurl.trim()
      ? property.imageurl.trim()
      : undefined;


  useEffect(() => {
    let cancelled = false;
    if (!id) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/properties/${encodeURIComponent(id)}`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-store',
          },
        });

        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(t || `Failed to load property (${res.status})`);
        }

        const data = await res.json().catch(() => null);

        const p: LooseProperty | null = data
          ? {
              ...data,
              ai_score:
                typeof (data as any).ai_score === 'number'
                  ? (data as any).ai_score
                  : typeof (data as any).score === 'number'
                    ? (data as any).score
                    : null,
              score:
                typeof (data as any).score === 'number'
                  ? (data as any).score
                  : typeof (data as any).ai_score === 'number'
                    ? (data as any).ai_score
                    : null,
              price: toNum((data as any).price),
              bedrooms: toNum((data as any).bedrooms),
              bathrooms: toNum((data as any).bathrooms),
              latitude: toNum((data as any).latitude) ?? null,
              longitude: toNum((data as any).longitude) ?? null,
              // Map snake_case DB field to camelCase for frontend components
              investmentType: (data as any).investment_type,
              propertyType: (data as any).property_type ?? (data as any).propertyType,
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

    return () => {
      cancelled = true;
    };
  }, [id]);

  const normalized = useMemo(() => (property ? normalizeProperty(property as any) : null), [property]);

  const price = normalized?.price ?? 0;
  const yieldPercent = useMemo(
    () =>
      normalized
        ? (getYieldPercent(normalized as any) ?? getYieldPercent(property as any) ?? undefined)
        : undefined,
    [normalized, property],
  );
  const roiRealPercent = typeof normalized?.roiPercent === 'number' ? normalized.roiPercent : undefined;
  const roiDisplay = useMemo(() => {
    if (!property) return { value: null, isProxy: false };
    const a = normalized ? getRoiDisplay(normalized as any) : { value: null, isProxy: false };
    if (a.value != null) return a;
    return getRoiDisplay(property as any);
  }, [normalized, property]);
  const roiValidationNote = getRoiProxyValidationNote(roiDisplay);

  const discountPercent = useMemo((): number | undefined => {
    if (!property) return undefined;
    const direct = toNum((property as any)?.discount_percent ?? (property as any)?.discount_estimate_pct);
    if (typeof direct === 'number' && Number.isFinite(direct)) return direct;

    const p = toNum((property as any)?.asking_price ?? (property as any)?.price);
    const v = toNum((property as any)?.estimated_value);
    if (typeof p === 'number' && p > 0 && typeof v === 'number' && v > 0) {
      return ((v - p) * 100) / v;
    }
    return undefined;
  }, [property]);

  const description = useMemo(() => {
    if (!property) return '';
    const d = (property as any)?.description;
    return typeof d === 'string' ? d.trim() : '';
  }, [property]);

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="card p-8 text-center">
            <div className="inline-block w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">Loading property details…</p>
          </div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="page-wrapper">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="card p-8">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }
  if (!property) {
    return (
      <div className="page-wrapper">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="card p-8">
            <p className="text-slate-600 dark:text-slate-400">No property found.</p>
          </div>
        </div>
      </div>
    );
  }

  const tldr = buildVerdict({
    yield_percent: yieldPercent,
    roi_percent: roiRealPercent,
    ai_score: (property as any).ai_score,
    score: (property as any).score,
    discount_percent: discountPercent,
    price: (property as any).price,
    asking_price: (property as any).asking_price,
    bedrooms: (property as any).bedrooms,
    bathrooms: (property as any).bathrooms,
    investmentType: (property as any).investmentType,
    propertyType: (property as any).propertyType,
  });
  const propertyLat = typeof property.latitude === 'number' ? property.latitude : null;
  const propertyLng = typeof property.longitude === 'number' ? property.longitude : null;
  const aiScore =
    typeof (property as any).ai_score === 'number'
      ? (property as any).ai_score
      : typeof (property as any).score === 'number'
        ? (property as any).score
        : undefined;
  const showDealScore =
    typeof aiScore === 'number';
  const showTradesmen = FF.TRADESMEN && propertyLat !== null && propertyLng !== null;
  const bestFitStrategy = investmentFitLabel(
    (property as any).investmentType,
    (property as any).propertyType,
  );
  const summaryInsights = [
    {
      label: 'Best suited for',
      value: bestFitStrategy,
      helper:
        bestFitStrategy === 'Flip'
          ? 'Check works budget, resale comps and legal pack before bidding.'
          : bestFitStrategy === 'BTL'
            ? 'Start with rent evidence, void assumptions and lender stress tests.'
            : 'Treat as a cautious review until the evidence base improves.',
    },
    {
      label: 'Main evidence',
      value: tldr.label,
      tone: tldr.tone,
      helper: tldr.tone === 'positive' ? 'Available inputs point to a stronger investor case; still verify the evidence.' : 'The case is based on limited available fields, so treat it as directional.',
    },
    {
      label: 'Main risk',
      value: roiValidationNote ? 'ROI proxy' : tldr.tone === 'positive' ? 'Offer discipline' : 'Evidence depth',
      helper: roiValidationNote ?? 'Validate rent, condition, fees and comparable sales before relying on the headline score.',
    },
    {
      label: 'Next action',
      value: tldr.tone === 'positive' ? 'Diligence pack' : tldr.tone === 'neutral' ? 'Validate assumptions' : 'Manual checks',
      helper:
        tldr.tone === 'positive'
          ? 'Prepare offer range, finance terms and inspection checklist.'
          : 'Confirm rent, comps, lease, EPC, condition and walk-away price.',
    },
  ];
  const investmentDescription = buildInvestmentDescription({
    title: property.title ? String(property.title) : undefined,
    location: property.location ? String(property.location) : undefined,
    propertyType: (property as any).propertyType ?? undefined,
    investmentType: (property as any).investmentType ?? undefined,
    bedrooms: typeof property.bedrooms === 'number' ? property.bedrooms : undefined,
    bathrooms: typeof property.bathrooms === 'number' ? property.bathrooms : undefined,
    price: typeof property.price === 'number' ? property.price : undefined,
    yieldPercent,
    roiPercent: roiValidationNote ? undefined : (roiDisplay.value ?? undefined),
    roiIsProxy: roiDisplay.isProxy,
    aiScore,
    dealQuality: tldr.label,
    strategyFit: bestFitStrategy,
    description,
  });

  return (
    <div className="page-wrapper">
      {/* Floating Stats & Actions Sidebar */}
      <QuickStatsActions
        propertyId={String(property.id ?? id)}
        property={property}
        price={normalized?.price ?? undefined}
        yieldPercent={yieldPercent}
        roiPercent={roiRealPercent}
        discountPercent={discountPercent}
        aiScore={aiScore}
      />

      <div className="max-w-7xl mx-auto px-4 py-8 lg:pr-64">{/* Add right padding on desktop for floating sidebar */}
        {/* Image-first (focal) carousel + details */}
        <div className="card mb-6 overflow-hidden !p-0">
          <ImageGallery
            imageUrls={imageUrls}
            fallbackImageUrl={fallbackImageUrl}
            placeholderSrc={PLACEHOLDER_IMG}
            title={property.title ? String(property.title) : undefined}
          />

          <div className="border-t border-slate-200 dark:border-slate-800">
            <PropertyHeader
              property={{
                title: (property as any).title ?? null,
                location: (property as any).location ?? null,
                bedrooms: (property as any).bedrooms ?? null,
                bathrooms: (property as any).bathrooms ?? null,
                price: (property as any).price ?? null,
                propertyType: (property as any).propertyType ?? null,
              }}
            />
          </div>

          <PropertyDescription brief={investmentDescription} />
          <WhySurfaced property={property as any} />
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Main content - single column now since sidebar is floating */}
          <div className="space-y-6">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Showing the most relevant insights first
            </div>
            {/* AI Deal Score - Always visible, gated for non-pro users */}
            {showDealScore ? (
              <CollapsibleCard
                title="AI Deal Score"
                icon={
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
                    <FiDollarSign className="w-5 h-5 text-white" />
                  </div>
                }
                defaultExpanded={true}
              >
                <GatedPanel
                  title="AI Deal Score"
                  requiredPlan="pro"
                  featureEnabled={true}
                  showPreviewWhenLocked={false}
                >
                  <DealScore property={property} />
                </GatedPanel>
              </CollapsibleCard>
            ) : null}

            {/* Investment Summary (AI-generated text) */}
            <CollapsibleCard
              title="Investment Summary"
              icon={
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
                  <FiFileText className="w-5 h-5 text-white" />
                </div>
              }
              defaultExpanded={true}
            >
              <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
                <div className="border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-brand-50/40 p-5 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-brand-950/20 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Investment summary
                      </div>
                      <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-950 dark:text-white">
                        {bestFitStrategy} · {tldr.label}
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        {tldr.sentence}
                      </p>
                    </div>
                    <span
                      className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${verdictToneClasses(
                        tldr.tone,
                      )}`}
                      aria-label={`Deal quality: ${tldr.label}`}
                    >
                      {tldr.label}
                    </span>
                  </div>
                </div>

                <div className="space-y-5 p-5 sm:p-6">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {summaryInsights.map((metric) => (
                      <div
                        key={metric.label}
                        className="rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/30"
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                          {metric.label}
                        </div>
                        <div className="mt-1 text-base font-bold tracking-tight text-slate-950 dark:text-white">
                          {metric.value}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {metric.helper}
                        </p>
                      </div>
                    ))}
                  </div>

                  <InvestmentSummary property={property as any} />

                  <ExitStrategyGenerator
                    title={String(property.title ?? '')}
                    location={String(property.location ?? '')}
                    price={typeof property.price === 'number' ? property.price : undefined}
                    yieldPercent={yieldPercent}
                    roiPercent={roiDisplay.value ?? undefined}
                    propertyType={(property as any).propertyType ?? undefined}
                    investmentType={(property as any).investmentType ?? undefined}
                    description={(property as any).description ?? undefined}
                  />
                </div>
              </section>
            </CollapsibleCard>

            <AreaInsights
              areaKey={String((property as any)?.area_key ?? (property as any)?.postcode ?? property.location ?? '')}
              postcode={String((property as any)?.postcode ?? '')}
              rentSource={(property as any)?.score_breakdown?.inputs?.rent_source}
              version={(property as any)?.score_breakdown?.version}
              defaultExpanded={false}
            />

            {/* Local Tradesmen & Services */}
            {showTradesmen && (
              <CollapsibleCard
                title="Local Tradesmen & Services"
                icon={
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
                    <FiTool className="w-5 h-5 text-white" />
                  </div>
                }
                defaultExpanded={false}
              >
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                      <span className="font-semibold">Renovation · Plumbing · Electrical · Surveyors</span>
                      <br />
                      Find qualified local tradespeople for your property project.
                    </p>

                    {/* Trade Type Filter */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <button
                        onClick={() => setSelectedTradeType('')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedTradeType === ''
                            ? 'bg-brand-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        All Trades
                      </button>
                      {['Builder', 'Plumber', 'Electrician', 'Roofer', 'Surveyor'].map((trade) => (
                        <button
                          key={trade}
                          onClick={() => setSelectedTradeType(trade)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            selectedTradeType === trade
                              ? 'bg-brand-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {trade}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tradesmen List */}
                  <TradesmenList
                    propertyLat={propertyLat!}
                    propertyLng={propertyLng!}
                    propertyId={String(property.id ?? id)}
                    tradeType={selectedTradeType || undefined}
                    radius={20}
                  />
                </div>
              </CollapsibleCard>
            )}

            {/* Investor Notes */}
            <CollapsibleCard
              title="Investor Notes"
              icon={
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
                  <FiEdit3 className="w-5 h-5 text-white" />
                </div>
              }
              defaultExpanded={false}
            >
              {'id' in property ? <NotesFields propertyId={(property as any).id} /> : null}
            </CollapsibleCard>

            {/* Investment Calculator - Scenario Based */}
            <InvestmentCalculator
              propertyId={String(property.id ?? id)}
              initialPrice={price}
            />

            {/* Location Map */}
            <CollapsibleCard
              title="Location"
              icon={
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
                  <FiMap className="w-5 h-5 text-white" />
                </div>
              }
              defaultExpanded={false}
            >
              <div className="rounded-lg overflow-hidden">
                <MapSingle property={property} height={400} zoom={16} scrollWheelZoom={false} />
              </div>
            </CollapsibleCard>
          </div>
        </div>
      </div>

      {/* Floating AI Chatbot - Always visible, gated for non-investor users */}
      <AIChatbot property={property as any} />
    </div>
  );
}
