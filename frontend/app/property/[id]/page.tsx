'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  FiDollarSign,
  FiTool,
  FiFileText,
  FiBarChart2,
  FiRepeat,
  FiGitBranch,
  FiEdit3,
  FiMap,
} from 'react-icons/fi';

import QuickStatsActions from '@/components/property_details/QuickStatsActions';
import InvestmentSummary from '@/components/property_details/InvestmentSummary';
import ExitStrategyGenerator from '@/components/property_details/ExitStrategyGenerator';
import DealScore from '@/components/property_details/DealScore';
import AreaIntelPanel from '@/components/property_details/AreaIntelPanel';
import CompsPanel from '@/components/property_details/CompsPanel';
import MapSingle from '@/components/property_details/MapSingle';
import GatedPanel from '@/components/property_details/GatedPanel';
import InvestmentCalculator from '@/components/property_details/InvestmentCalculator';
import CollapsibleCard from '@/components/property_details/CollapsibleCard';
import ImageGallery from '@/components/property_details/ImageGallery';
import PropertyHeader from '@/components/property_details/PropertyHeader';
import TradesmenList from '@/components/tradesmen/TradesmenList';

import type { Property } from '@/types';
import { getSupabase } from '@/lib/supabaseClient';
import { FF } from '@/lib/flags';
import { buildVerdict, verdictToneClasses } from '@/lib/verdict';

/** ---- Client-only widgets (no SSR) ---- */
const StampDutyCalculator = dynamic(
  () => import('@/components/property_details/StampDutyCalculator'),
  { ssr: false }
);

const NotesFields = dynamic(
  () => import('@/components/property_details/NotesFields'),
  { ssr: false }
);

const AIChatbot = dynamic(
  () => import('@/components/property_details/AIChatbot'),
  { ssr: false }
);

/** ------------------------------------- */

type LooseProperty = Partial<Property> & {
  latitude?: number | null;
  longitude?: number | null;
  imageurl?: string | null;
  image_urls?: unknown;
};

const toNum = (v: unknown) =>
  typeof v === 'number' ? v : v == null || v === '' ? undefined : Number(v);

export default function PropertyDetailsPage() {
  const { id } = useParams() as { id: string };
  const sb = useMemo(() => getSupabase(), []);
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
        const { data, error } = await sb.from('properties').select('*').eq('id', id).single();
        if (error) throw error;

        const p: LooseProperty | null = data
          ? {
              ...data,
              price: toNum((data as any).price),
              bedrooms: toNum((data as any).bedrooms),
              bathrooms: toNum((data as any).bathrooms),
              yield_percent: toNum((data as any).yield_percent),
              roi_percent: toNum((data as any).roi_percent),
              latitude: toNum((data as any).latitude) ?? null,
              longitude: toNum((data as any).longitude) ?? null,
              // Map snake_case DB field to camelCase for frontend components
              investmentType: (data as any).investment_type,
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
  }, [id, sb]);

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

  const price = typeof property.price === 'number' ? property.price : 0;

  const tldr = buildVerdict({
    yield_percent: (property as any).yield_percent,
    roi_percent: (property as any).roi_percent,
    ai_score: (property as any).ai_score,
    score: (property as any).score,
    discount_percent: (property as any).discount_percent,
    price: (property as any).price,
    asking_price: (property as any).asking_price,
    bedrooms: (property as any).bedrooms,
    bathrooms: (property as any).bathrooms,
    investmentType: (property as any).investmentType,
    propertyType: (property as any).propertyType,
  });

  return (
    <div className="page-wrapper">
      {/* Floating Stats & Actions Sidebar */}
      <QuickStatsActions
        propertyId={String(property.id ?? id)}
        price={property.price ?? undefined}
        yieldPercent={property.yield_percent ?? undefined}
        roiPercent={property.roi_percent ?? undefined}
      />

      <div className="max-w-7xl mx-auto px-4 py-8 lg:pr-72">{/* Add right padding on desktop for floating sidebar */}
        {/* Image-first (focal) carousel + details */}
        <div className="card mb-6 overflow-hidden">
          <ImageGallery
            imageUrls={imageUrls}
            fallbackImageUrl={fallbackImageUrl}
            placeholderSrc={PLACEHOLDER_IMG}
            title={property.title ? String(property.title) : undefined}
          />

          <PropertyHeader property={property as any} />
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Main content - single column now since sidebar is floating */}
          <div className="space-y-6">
            {/* AI Deal Score - Always visible, gated for non-pro users */}
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
              >
                <DealScore property={property} />
              </GatedPanel>
            </CollapsibleCard>

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
              <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      TL;DR
                    </div>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                      {tldr.sentence}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-semibold ${verdictToneClasses(
                      tldr.tone,
                    )}`}
                    aria-label={`Verdict: ${tldr.label}`}
                  >
                    {tldr.label}
                  </span>
                </div>

                {tldr.bullets.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {tldr.bullets.map((b) => (
                      <li key={b} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" aria-hidden />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <InvestmentSummary property={property as any} />
            </CollapsibleCard>

            {/* Area Intelligence - Always visible, gated for non-pro users */}
            <CollapsibleCard
              title="Area Intelligence"
              icon={
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
                  <FiBarChart2 className="w-5 h-5 text-white" />
                </div>
              }
              defaultExpanded={false}
            >
              <GatedPanel
                title="Area Intelligence"
                requiredPlan="pro"
                featureEnabled={true}
              >
                <AreaIntelPanel areaKey={property.location || ''} />
              </GatedPanel>
            </CollapsibleCard>

            {/* Comparable Sales - Always visible, gated for non-pro users */}
            <CollapsibleCard
              title="Comparable Sales"
              icon={
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
                  <FiRepeat className="w-5 h-5 text-white" />
                </div>
              }
              defaultExpanded={false}
            >
              <GatedPanel
                title="Comparable Sales"
                requiredPlan="pro"
                featureEnabled={true}
              >
                <CompsPanel postcode={property.location || ''} />
              </GatedPanel>
            </CollapsibleCard>

            {/* Local Tradesmen & Services */}
            {property.latitude && property.longitude && (
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
                    propertyLat={property.latitude}
                    propertyLng={property.longitude}
                    propertyId={String(property.id ?? id)}
                    tradeType={selectedTradeType || undefined}
                    radius={20}
                  />
                </div>
              </CollapsibleCard>
            )}

            {/* Exit Strategies */}
            <CollapsibleCard
              title="Exit Strategies"
              icon={
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
                  <FiGitBranch className="w-5 h-5 text-white" />
                </div>
              }
              defaultExpanded={false}
            >
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
            </CollapsibleCard>

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

            {/* Stamp Duty Calculator */}
            <StampDutyCalculator price={price} />

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
                <MapSingle property={property} height={400} zoom={14} scrollWheelZoom={false} />
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
