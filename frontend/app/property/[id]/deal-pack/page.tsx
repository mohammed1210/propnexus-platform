import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import PropertyDealPackTemplate from '@/components/property_details/PropertyDealPackTemplate';
import { buildPropertyDealPackModel } from '@/lib/propertyDealPack';
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
  const [{ id }, { source }] = await Promise.all([params, searchParams]);
  const userId = await getOptionalClerkUserId();
  let model: ReturnType<typeof buildPropertyDealPackModel> | null = null;

  try {
    const property = await fetchPropertyById(id, userId);
    if (!property) notFound();

    model = buildPropertyDealPackModel({
      propertyId: id,
      property,
      url: source,
    });
  } catch (error) {
    if (isNextNotFoundError(error)) {
      throw error;
    }
    console.error('Failed to render deal pack page', error);
  }

  if (model) {
    return <PropertyDealPackTemplate model={model} />;
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
