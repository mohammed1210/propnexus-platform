'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import PageWrapper from '@/components/PageWrapper';

import PropertySummaryCard from '@/components/property_details/PropertySummaryCard';
import QuickStatsCard from '@/components/property_details/QuickStatsCard';
import InvestmentSummary from '@/components/property_details/InvestmentSummary';
import ExitStrategyGenerator from '@/components/property_details/ExitStrategyGenerator';
import InvestmentCalculator from '@/components/property_details/InvestmentCalculator';
import StampDutyCalculator from '@/components/property_details/StampDutyCalculator';
import NotesFields from '@/components/property_details/NotesFields';
import AIChatbot from '@/components/property_details/AIChatbot';
import DealScore from '@/components/property_details/DealScore';
import AreaIntelPanel from '@/components/property_details/AreaIntelPanel';
import CompsPanel from '@/components/property_details/CompsPanel';
import MapSingle from '@/components/property_details/MapSingle';
import QuickActions from '@/components/property_details/QuickActions';
import PlanBadge from '@/components/PlanBadge';
import GatedPanel from '@/components/property_details/GatedPanel';

import type { Property } from '@/types';
import { getSupabase } from '@/lib/supabaseClient';
import { FF } from '@/lib/flags';

type LooseProperty = Partial<Property> & {
  latitude?: number | null;
  longitude?: number | null;
  imageurl?: string | null; // some rows use this
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
        // Read EXACTLY the same source as the listings page
        const { data, error } = await sb.from('properties').select('*').eq('id', id).single();

        if (error) throw error;

        // Normalize a few fields the UI expects
        const p: LooseProperty | null = data
          ? {
              ...data,
              // make sure these are numbers or undefined
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
      <PageWrapper showOrbs={false}>
        <Section>
          <p className="card p-4">Loading property details…</p>
        </Section>
      </PageWrapper>
    );
  }
  if (error) {
    return (
      <PageWrapper showOrbs={false}>
        <Section>
          <p className="text-red-600 card p-4">{error}</p>
        </Section>
      </PageWrapper>
    );
  }
  if (!property) {
    return (
      <PageWrapper showOrbs={false}>
        <Section>
          <p className="card p-4">No property found.</p>
        </Section>
      </PageWrapper>
    );
  }

  const price = typeof property.price === 'number' ? property.price : 0;

  return (
    <PageWrapper showOrbs={false} className="bg-white/50 dark:bg-slate-900/30">
      <Section>
        {/* Quick Actions Sidebar (Desktop: right fixed, Mobile: bottom fixed) */}
        <QuickActions
          propertyId={String(property.id ?? id)}
          price={property.price ?? undefined}
          yieldPercent={property.yield_percent ?? undefined}
          roiPercent={property.roi_percent ?? undefined}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Left column - Main content */}
          <div className="space-y-6">
            {/* Property Summary with integrated metrics */}
            <PropertySummaryCard
              property={{
                title: property.title,
                location: property.location,
                price: property.price,
                bedrooms: property.bedrooms,
                bathrooms: property.bathrooms,
                propertyType: (property as any).propertyType,
                investmentType: (property as any).investmentType,
              }}
              metrics={{
                yield: property.yield_percent,
                roi: property.roi_percent,
              }}
            />

            {/* AI Deal Score */}
            {FF.DEAL_SCORE && (
              <div className="card">
                <h2 className="font-semibold text-lg mb-4">AI Deal Score</h2>
                <DealScore property={property} />
              </div>
            )}

            {/* Investment Summary (AI-generated text) */}
            <div className="card">
              <h2 className="font-semibold text-lg mb-2">Investment Summary</h2>
              <InvestmentSummary property={property as any} />
            </div>

            {/* Area Intelligence & Comps */}
            {property.location && (
              <>
                {FF.AREA_INTEL && (
                  <div className="card">
                    <h2 className="font-semibold text-lg mb-4">Area Intelligence</h2>
                    <AreaIntelPanel areaKey={property.location} />
                  </div>
                )}

                {FF.COMPS && (
                  <div className="card">
                    <h2 className="font-semibold text-lg mb-4">Comparable Sales</h2>
                    <CompsPanel postcode={property.location} />
                  </div>
                )}
              </>
            )}

            {/* Exit Strategies */}
            <div className="rounded-xl border border-slate-200/15 dark:border-slate-700/30 bg-white dark:bg-zinc-900 shadow-sm p-4 md:p-6">
              <h2 className="text-lg font-semibold tracking-tight mb-3 text-gray-900 dark:text-gray-100">
                Exit Strategies
              </h2>
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
            </div>

            {/* Investor Notes */}
            <div className="card">
              <h2 className="font-semibold text-lg mb-2">Investor Notes</h2>
              {'id' in property ? <NotesFields propertyId={(property as any).id} /> : null}
            </div>

            {/* Mortgage & BRRR Calculator */}
            <MortgageCalculator price={price} />

            {/* Stamp Duty Calculator */}
            <StampDutyCalculator price={price} />
          </div>

          {/* Right column - Sticky sidebar (Desktop only) */}
          <div className="hidden lg:block space-y-6">
            <div className="sticky top-6 space-y-6">
              {/* Quick Stats */}
              <QuickStatsCard
                price={property.price ?? undefined}
                yieldPercent={property.yield_percent ?? undefined}
                roiPercent={property.roi_percent ?? undefined}
              />

              {/* Location Map */}
              <div className="panel">
                <h3 className="font-semibold text-sm text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">
                  Location
                </h3>
                <MapSingle
                  property={property}
                  height={250}
                  zoom={14}
                  scrollWheelZoom={false}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: Show map in main content */}
        <div className="lg:hidden mt-6">
          <div className="panel">
            <h3 className="font-semibold text-sm text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">
              Location
            </h3>
            <MapSingle
              property={property}
              height={250}
              zoom={14}
              scrollWheelZoom={false}
            />
          </div>
        </div>

        {/* Mobile Quick Actions (fixed bottom bar) */}
        <div className="lg:hidden">
          <QuickActions
            propertyId={String(property.id ?? id)}
            price={property.price ?? undefined}
            yieldPercent={property.yield_percent ?? undefined}
            roiPercent={property.roi_percent ?? undefined}
          />
        </div>

        {/* Floating local chatbot */}
        {FF.AI_CHAT && <AIChatbot property={property as any} />}
      </Section>
    </PageWrapper>
  );
}
