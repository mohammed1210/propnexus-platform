'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { FiMapPin, FiHome, FiDroplet, FiTrendingUp, FiDollarSign, FiTool } from 'react-icons/fi';

import PropertySummaryCard from '@/components/property_details/PropertySummaryCard';
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
import TradesmenList from '@/components/tradesmen/TradesmenList';

import type { Property } from '@/types';
import { getSupabase } from '@/lib/supabaseClient';
import { FF } from '@/lib/flags';

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

  const hasAnyPhoto = imageUrls.length > 0 || Boolean(fallbackImageUrl);

  const initialMainImage = imageUrls[0] || fallbackImageUrl || PLACEHOLDER_IMG;
  const [mainImage, setMainImage] = useState<string>(PLACEHOLDER_IMG);

  useEffect(() => {
    setMainImage(initialMainImage);
  }, [initialMainImage]);

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
        {/* Property Header Card */}
        <div className="card mb-6 p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                {property.title || 'Property Details'}
              </h1>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-4">
                <FiMapPin className="w-5 h-5" />
                <span>{property.location || 'Location not specified'}</span>
              </div>
              <div className="flex flex-wrap gap-4">
                {property.bedrooms !== undefined && (
                  <div className="flex items-center gap-2">
                    <FiHome className="w-5 h-5 text-brand-500" />
                    <span className="text-slate-700 dark:text-slate-300">{property.bedrooms} beds</span>
                  </div>
                )}
                {property.bathrooms !== undefined && (
                  <div className="flex items-center gap-2">
                    <FiDroplet className="w-5 h-5 text-brand-500" />
                    <span className="text-slate-700 dark:text-slate-300">{property.bathrooms} baths</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="text-right">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Price</div>
                <div className="text-3xl font-bold text-brand-600 dark:text-brand-400">
                  £{(property.price ?? 0).toLocaleString()}
                </div>
              </div>
              {property.yield_percent !== undefined && (
                <div className="flex items-center gap-2 justify-end">
                  <FiTrendingUp className="w-5 h-5 text-emerald-500" />
                  <span className="px-3 py-1 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    {property.yield_percent.toFixed(1)}% yield
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Image Gallery */}
        <div className="card mb-6 overflow-hidden">
          <div className="aspect-[16/9] bg-slate-100 dark:bg-slate-900 relative">
            <Image
              src={mainImage}
              alt={property.title ? String(property.title) : 'Property image'}
              fill
              sizes="100vw"
              className="object-cover"
              unoptimized
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                if (img.src.endsWith(PLACEHOLDER_IMG)) return;
                img.src = PLACEHOLDER_IMG;
                setMainImage(PLACEHOLDER_IMG);
              }}
            />

            {!hasAnyPhoto ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="px-3 py-1.5 rounded-lg bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm text-sm font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-800/70">
                  No photos available
                </div>
              </div>
            ) : null}

            {imageUrls.length > 0 ? (
              <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm text-sm font-semibold text-slate-900">
                {Math.max(0, imageUrls.findIndex((u) => u === mainImage)) + 1} / {imageUrls.length}
              </div>
            ) : null}
          </div>

          {imageUrls.length > 1 ? (
            <div className="p-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {imageUrls.map((u, idx) => {
                  const selected = u === mainImage;
                  return (
                    <button
                      key={`${u}-${idx}`}
                      type="button"
                      onClick={() => setMainImage(u)}
                      className={`shrink-0 rounded-lg overflow-hidden border transition-colors ${
                        selected
                          ? 'border-brand-500 ring-2 ring-brand-500/30'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                      aria-label={`View image ${idx + 1}`}
                    >
                      <Image
                        src={u}
                        alt={`Thumbnail ${idx + 1}`}
                        width={80}
                        height={64}
                        className="w-20 h-16 object-cover"
                        unoptimized
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          if (img.src.endsWith(PLACEHOLDER_IMG)) return;
                          img.src = PLACEHOLDER_IMG;
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
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
            <CollapsibleCard title="Investment Summary" defaultExpanded={true}>
              <InvestmentSummary property={property as any} />
            </CollapsibleCard>

            {/* Area Intelligence - Always visible, gated for non-pro users */}
            <CollapsibleCard title="Area Intelligence" defaultExpanded={false}>
              <GatedPanel
                title="Area Intelligence"
                requiredPlan="pro"
                featureEnabled={true}
              >
                <AreaIntelPanel areaKey={property.location || ''} />
              </GatedPanel>
            </CollapsibleCard>

            {/* Comparable Sales - Always visible, gated for non-pro users */}
            <CollapsibleCard title="Comparable Sales" defaultExpanded={false}>
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
            <CollapsibleCard title="Exit Strategies" defaultExpanded={false}>
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
            <CollapsibleCard title="Investor Notes" defaultExpanded={false}>
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
            <CollapsibleCard title="Location" defaultExpanded={false}>
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
