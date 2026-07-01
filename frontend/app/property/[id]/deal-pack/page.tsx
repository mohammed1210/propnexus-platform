import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import UpgradeButton from '@/components/UpgradeButton';
import PropertyDealPackTemplate from '@/components/property_details/PropertyDealPackTemplate';
import { FF } from '@/lib/flags';
import { buildPropertyDealPackModel } from '@/lib/propertyDealPack';
import { getCheckoutConfigForPlan } from '@/lib/pricingPlans';
import { getServerEntitlements } from '@/lib/server/userPlan';
import { fetchPropertyById, getOptionalClerkUserId } from '@/lib/server/propertyData';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

type DealPackPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string }>;
};

const isNextNotFoundError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const digest = 'digest' in error ? (error as { digest?: string }).digest : undefined;
  return digest === 'NEXT_NOT_FOUND' || digest === 'NEXT_HTTP_ERROR_FALLBACK;404';
};

export default async function PropertyDealPackPage({ params, searchParams }: DealPackPageProps) {
  if (!FF.DEAL_PACK) notFound();

  const [{ id }, { source }] = await Promise.all([params, searchParams]);
  const userId = await getOptionalClerkUserId();
  const entitlements = await getServerEntitlements();
  const upgrade = getCheckoutConfigForPlan('investor_pro');
  let model: ReturnType<typeof buildPropertyDealPackModel> | null = null;
  let property: Record<string, unknown> | null = null;

  try {
    property = await fetchPropertyById(id, userId);
    if (!property) notFound();

    if (entitlements.hasDealPack) {
      model = buildPropertyDealPackModel({
        propertyId: id,
        property,
        url: source,
      });
    }
  } catch (error) {
    if (isNextNotFoundError(error)) {
      throw error;
    }
    console.error('Failed to render deal pack page', error);
  }

  if (model) {
    return <PropertyDealPackTemplate model={model} />;
  }

  if (property && !entitlements.hasDealPack) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-12 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">Deal Pack preview</p>
          <h1 className="mt-4 text-3xl font-semibold">{String(property.title ?? 'Property')} printable pack is part of Investor Pro</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200">
            This preview route stays accessible so you can see what the pack includes, but the full printable layout and PDF export stay locked until Investor Pro.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {['Deal summary and evidence snapshot', 'Offer range, finance stress-test and walk-away framing', 'Printable PDF export for live offers'].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-8 max-w-xs">
            <UpgradeButton priceId={upgrade.priceId} productId={upgrade.productId} className="btn-primary w-full justify-center">
              Unlock Investor Pro
            </UpgradeButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">PropNexus</p>
        <h1 className="mt-4 text-3xl font-semibold">Deal pack unavailable</h1>
        <p className="mt-4 text-sm leading-7 text-slate-200">
          We could not prepare the printable deal pack for this property right now. Please return to the live listing and retry the export.
        </p>
      </div>
    </div>
  );
}
