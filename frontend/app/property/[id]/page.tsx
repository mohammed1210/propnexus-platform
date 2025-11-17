'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { FiMapPin, FiHome, FiDroplet, FiTrendingUp, FiDollarSign } from 'react-icons/fi';

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
};

const toNum = (v: unknown) =>
  typeof v === 'number' ? v : v == null || v === '' ? undefined : Number(v);

export default function PropertyDetailsPage() {
  const { id } = useParams() as { id: string };
  const sb = useMemo(() => getSupabase(), []);
  const [property, setProperty] = useState<LooseProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
