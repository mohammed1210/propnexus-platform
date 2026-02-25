'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  FiDollarSign,
  FiTool,
  FiFileText,
  FiBarChart2,
  FiGitBranch,
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
import TradesmenList from '@/components/tradesmen/TradesmenList';

import type { Property } from '@/types';
import { buildVerdict, verdictToneClasses } from '@/lib/verdict';
import { formatPercent, getRoiPercent, getYieldPercent, normalizeProperty } from '@/lib/normalizeProperty';

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
};

const toNum = (v: unknown) =>
  typeof v === 'number' ? v : v == null || v === '' ? undefined : Number(v);

const fmtGBP = (n: unknown): string => {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return 'N/A';
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `£${Math.round(v).toLocaleString('en-GB')}`;
  }
};

const fmtPct = (n: unknown): string => {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 'N/A';
  return `${v.toFixed(1)}%`;
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
              price: toNum((data as any).price),
              bedrooms: toNum((data as any).bedrooms),
              bathrooms: toNum((data as any).bathrooms),
              yield_percent: toNum((data as any).yield_percent),
              roi_percent: toNum((data as any).roi_percent),
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
  const rentMonthly = normalized?.rentMonthly ?? undefined;
  const yieldPercent = useMemo(
    () => (property ? getYieldPercent(property as any) ?? undefined : undefined),
    [property],
  );
  const roiPercent = useMemo(
    () => (property ? getRoiPercent(property as any) ?? undefined : undefined),
    [property],
  );
  const roiDisplay = roiPercent;

  const estValue = useMemo((): number | undefined => {
    if (!property) return undefined;
    const v = toNum((property as any)?.estimated_value);
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;
  }, [property]);

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
    roi_percent: roiPercent,
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

  return (
    <div className="page-wrapper">
      {/* Floating Stats & Actions Sidebar */}
      <QuickStatsActions
        propertyId={String(property.id ?? id)}
        property={property}
        price={normalized?.price ?? undefined}
        yieldPercent={yieldPercent}
        roiPercent={roiPercent}
        discountPercent={discountPercent}
      />

      <div className="max-w-7xl mx-auto px-4 py-8 lg:pr-72">{/* Add right padding on desktop for floating sidebar */}
        {/* Image-first (focal) carousel + details */}
        <div className="card mb-6 overflow-hidden">
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

          <div className="border-t border-slate-200 dark:border-slate-800">
            <ImageGallery
              imageUrls={imageUrls}
              fallbackImageUrl={fallbackImageUrl}
              placeholderSrc={PLACEHOLDER_IMG}
              title={property.title ? String(property.title) : undefined}
            />
          </div>

          {description ? (
            <div className="p-6 pt-5 border-t border-slate-200 dark:border-slate-800">
              <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Description</div>
              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                {description.split(/\n{2,}/).map((para, idx) => {
                  const t = para.trim();
                  if (!t) return null;
                  return <p key={idx}>{t}</p>;
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Main content - single column now since sidebar is floating */}
          <div className="space-y-6">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Showing the most relevant insights first
            </div>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/20 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Summary
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

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/20 p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Price</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {fmtGBP(property.price)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/20 p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Est. value</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {fmtGBP(estValue)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/20 p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Discount</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {typeof discountPercent === 'number' ? `${discountPercent.toFixed(0)}%` : 'N/A'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/20 p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Yield</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatPercent(yieldPercent)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/20 p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">ROI</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatPercent(roiDisplay)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/20 p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Rent est.</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {typeof rentMonthly === 'number' ? `${fmtGBP(rentMonthly)}/mo` : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/20 p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
                      <FiGitBranch className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Exit Strategy
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                    <ul className="space-y-1">
                      <li>Typical hold: 3–5 years (market dependent)</li>
                      <li>Option 1: Sell to realise uplift</li>
                      <li>Option 2: Refinance after stabilising rent</li>
                    </ul>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <ExitStrategyGenerator
                      title={String(property.title ?? '')}
                      location={String(property.location ?? '')}
                      price={typeof property.price === 'number' ? property.price : undefined}
                      yield_percent={yieldPercent}
                        roi_percent={roiPercent}
                      propertyType={(property as any).propertyType ?? undefined}
                      investmentType={(property as any).investmentType ?? undefined}
                      description={(property as any).description ?? undefined}
                    />
                  </div>
                </div>
              </div>

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

            <AreaInsights
              areaKey={property.location || ''}
              postcode={property.location || ''}
              rentSource={(property as any)?.score_breakdown?.inputs?.rent_source}
              version={(property as any)?.score_breakdown?.version}
              defaultExpanded={false}
            />

            {/* Local Tradesmen & Services */}
            {typeof property.latitude === 'number' && typeof property.longitude === 'number' && (
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
