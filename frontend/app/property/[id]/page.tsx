'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import PageWrapper from '@/components/PageWrapper';

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
    <PageWrapper showOrbs={false} className="bg-white/50 dark:bg-zinc-900/30">
      <Section>
        <SectionTitle>{property.title ?? 'Property Details'}</SectionTitle>

        {/* Sprint 11.3: Desktop sticky sidebar + mobile bottom bar */}
        <div className="lg:flex lg:gap-6">
          {/* Main content - left side on desktop */}
          <div className="flex-1 space-y-6">
            {/* Investment Summary */}
            <div className="rounded-xl border border-slate-200/15 dark:border-slate-700/30 bg-white dark:bg-zinc-900 shadow-sm p-4 md:p-6">
              <h2 className="text-lg font-semibold tracking-tight mb-3 text-gray-900 dark:text-gray-100">
                Investment Summary
              </h2>
              <InvestmentSummary property={property as any} />
            </div>

            {/* Notes */}
            <div className="rounded-xl border border-slate-200/15 dark:border-slate-700/30 bg-white dark:bg-zinc-900 shadow-sm p-4 md:p-6">
              <h2 className="text-lg font-semibold tracking-tight mb-3 text-gray-900 dark:text-gray-100">
                Investor Notes
              </h2>
              {'id' in property ? <NotesFields propertyId={(property as any).id} /> : null}
            </div>

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

            {/* ===== AI Deal Score ===== */}
            {FF.DEAL_SCORE && (
              <div className="rounded-xl border border-slate-200/15 dark:border-slate-700/30 bg-white dark:bg-zinc-900 shadow-sm p-4 md:p-6">
                <h2 className="text-lg font-semibold tracking-tight mb-3 text-gray-900 dark:text-gray-100">
                  AI Deal Score
                </h2>
                <GatedPanel
                  title="AI Deal Score"
                  requiredPlan="pro"
                  featureEnabled={FF.DEAL_SCORE}
                >
                  <DealScore property={property} />
                </GatedPanel>
              </div>
            )}

            {/* ===== Area Intelligence & Comps ===== */}
            {property.location && (
              <>
                {FF.AREA_INTEL && (
                  <div className="rounded-xl border border-slate-200/15 dark:border-slate-700/30 bg-white dark:bg-zinc-900 shadow-sm p-4 md:p-6">
                    <h2 className="text-lg font-semibold tracking-tight mb-3 text-gray-900 dark:text-gray-100">
                      Area Intelligence
                    </h2>
                    <GatedPanel
                      title="Area Intelligence"
                      requiredPlan="pro"
                      featureEnabled={FF.AREA_INTEL}
                    >
                      <AreaIntelPanel areaKey={property.location} />
                    </GatedPanel>
                  </div>
                )}

                {FF.COMPS && (
                  <div className="rounded-xl border border-slate-200/15 dark:border-slate-700/30 bg-white dark:bg-zinc-900 shadow-sm p-4 md:p-6">
                    <h2 className="text-lg font-semibold tracking-tight mb-3 text-gray-900 dark:text-gray-100">
                      Comparable Sales
                    </h2>
                    <GatedPanel
                      title="Comparable Sales"
                      requiredPlan="investor"
                      featureEnabled={FF.COMPS}
                    >
                      <CompsPanel postcode={property.location} />
                    </GatedPanel>
                  </div>
                )}
              </>
            )}

            {/* Sprint 11.3: Investment Calculator */}
            <InvestmentCalculator propertyId={String(property.id ?? id)} initialPrice={price} />

            {/* Stamp Duty */}
            <div className="rounded-xl border border-slate-200/15 dark:border-slate-700/30 bg-white dark:bg-zinc-900 shadow-sm p-4 md:p-6">
              <h2 className="text-lg font-semibold tracking-tight mb-3 text-gray-900 dark:text-gray-100">
                Stamp Duty Calculator
              </h2>
              <StampDutyCalculator price={price} />
            </div>
          </div>

          {/* Right sidebar - sticky on desktop, stacks on mobile */}
          <div className="lg:w-80 xl:w-96 space-y-6 mt-6 lg:mt-0">
            <div className="lg:sticky lg:top-6 space-y-6">
              {/* Quick Stats */}
              <div className="rounded-xl border border-slate-200/15 dark:border-slate-700/30 bg-white dark:bg-zinc-900 shadow-sm p-4 md:p-6">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Quick Stats
                </h3>
                <div className="space-y-3">
                  {price !== undefined && price > 0 && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Price</div>
                      <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        £{price.toLocaleString()}
                      </div>
                    </div>
                  )}
                  {property.yield_percent !== undefined && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Yield</div>
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">
                        {property.yield_percent.toFixed(1)}%
                      </div>
                    </div>
                  )}
                  {property.roi_percent !== undefined && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">ROI</div>
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {property.roi_percent.toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Plan Badge */}
              <div className="rounded-xl border border-slate-200/15 dark:border-slate-700/30 bg-white dark:bg-zinc-900 shadow-sm p-4">
                <PlanBadge />
              </div>

              {/* Map */}
              <div className="rounded-xl border border-slate-200/15 dark:border-slate-700/30 bg-white dark:bg-zinc-900 shadow-sm p-4 md:p-6">
                <h2 className="text-lg font-semibold tracking-tight mb-3 text-gray-900 dark:text-gray-100">
                  Location
                </h2>
                <MapSingle property={property} height={240} zoom={14} scrollWheelZoom={false} />
              </div>

              {/* Quick Actions - desktop version */}
              <div className="hidden lg:block rounded-xl border border-slate-200/15 dark:border-slate-700/30 bg-white dark:bg-zinc-900 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Quick Actions
                </h3>
                <QuickActions
                  propertyId={String(property.id ?? id)}
                  price={property.price ?? undefined}
                  yieldPercent={property.yield_percent ?? undefined}
                  roiPercent={property.roi_percent ?? undefined}
                />
              </div>
            </div>
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
