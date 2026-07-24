'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { FiArrowRight, FiCheckCircle, FiLink2, FiZap } from 'react-icons/fi';

import InfoDisclaimer from '@/components/legal/InfoDisclaimer';
import {
  analyseDealSchema,
  analysePropertyTypeOptions,
  type AnalyseDealInput,
} from '@/lib/analyseDealSchema';
import { normalizeUkPostcode, parseListingText } from '@/lib/parseListingText';

type FormState = {
  sourceUrl: string;
  listingText: string;
  title: string;
  location: string;
  postcode: string;
  price: string;
  bedrooms: string;
  bathrooms: string;
  propertyType: string;
  estimatedMonthlyRent: string;
  description: string;
};

type FieldErrorMap = Partial<Record<keyof FormState, string>>;

const initialState: FormState = {
  sourceUrl: '',
  listingText: '',
  title: '',
  location: '',
  postcode: '',
  price: '',
  bedrooms: '',
  bathrooms: '',
  propertyType: '',
  estimatedMonthlyRent: '',
  description: '',
};

const inputClassName =
  'h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500';

function buildFieldErrors(form: FormState): FieldErrorMap {
  const parsed = analyseDealSchema.safeParse({
    sourceUrl: form.sourceUrl,
    title: form.title,
    location: form.location,
    postcode: form.postcode,
    price: form.price,
    bedrooms: form.bedrooms,
    bathrooms: form.bathrooms,
    propertyType: form.propertyType,
    estimatedMonthlyRent: form.estimatedMonthlyRent,
    description: form.description,
  } satisfies Record<keyof AnalyseDealInput, unknown>);

  if (parsed.success) return {};

  const flattened = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const nextErrors: FieldErrorMap = {};
  for (const [key, value] of Object.entries(flattened)) {
    if (value && value.length > 0) {
      nextErrors[key as keyof FormState] = value[0];
    }
  }
  return nextErrors;
}

function buildDefaultTitle(form: FormState): string {
  const suffix = form.postcode.trim() || form.location.trim() || 'Unknown location';
  return `Manual deal — ${suffix}`.slice(0, 240);
}

function AnalysePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState<FormState>(initialState);
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractMessage, setExtractMessage] = useState<string | null>(null);

  const prefills = useMemo(() => {
    const sourceUrl = searchParams.get('sourceUrl')?.trim() || '';
    const rawLocation = searchParams.get('location')?.trim() || '';
    const postcode = normalizeUkPostcode(rawLocation) || '';

    return {
      sourceUrl,
      postcode,
      location: postcode ? '' : rawLocation,
    };
  }, [searchParams]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      sourceUrl: current.sourceUrl || prefills.sourceUrl,
      postcode: current.postcode || prefills.postcode,
      location: current.location || prefills.location,
    }));
  }, [prefills]);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === 'listingText') {
      setExtractMessage(null);
    }
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const nextErrors = buildFieldErrors(form);
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError('Check the highlighted deal details and try again.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: form.sourceUrl,
          title: form.title || buildDefaultTitle(form),
          location: form.location,
          postcode: form.postcode,
          price: form.price,
          bedrooms: form.bedrooms,
          bathrooms: form.bathrooms,
          propertyType: form.propertyType,
          estimatedMonthlyRent: form.estimatedMonthlyRent,
          description: form.description,
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const serverFieldErrors = (result?.fieldErrors ?? {}) as Record<string, string[] | string | undefined>;
        const nextServerErrors: FieldErrorMap = {};
        for (const [key, value] of Object.entries(serverFieldErrors)) {
          if (typeof value === 'string') {
            nextServerErrors[key as keyof FormState] = value;
          } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
            nextServerErrors[key as keyof FormState] = value[0];
          }
        }
        if (Object.keys(nextServerErrors).length > 0) {
          setFieldErrors(nextServerErrors);
        }
        throw new Error(result?.message || 'Could not generate a deal pack.');
      }

      const propertyId = String(result?.property_id || result?.property?.id || '').trim();
      if (!propertyId) {
        throw new Error('Deal created but no property id was returned.');
      }

      router.push(`/property/${encodeURIComponent(propertyId)}`);
    } catch (submitError: any) {
      setError(submitError?.message || 'Could not generate a deal pack.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleExtractDetails() {
    const parsed = parseListingText(form.listingText);
    const updates: Partial<FormState> = {};
    const meaningfulSignalCount = [
      parsed.price,
      parsed.estimatedMonthlyRent,
      parsed.bedrooms,
      parsed.bathrooms,
      parsed.postcode,
      parsed.propertyType,
    ].filter((value) => value !== undefined && value !== null && value !== '').length;

    if (meaningfulSignalCount === 0) {
      setExtractMessage('We could not detect much from that text. Please add the key fields manually.');
      return;
    }

    if (!form.title.trim() && parsed.title) updates.title = parsed.title;
    if (!form.postcode.trim() && parsed.postcode) updates.postcode = parsed.postcode;
    if (!form.price.trim() && typeof parsed.price === 'number') updates.price = String(parsed.price);
    if (!form.estimatedMonthlyRent.trim() && typeof parsed.estimatedMonthlyRent === 'number') {
      updates.estimatedMonthlyRent = String(parsed.estimatedMonthlyRent);
    }
    if (!form.bedrooms.trim() && typeof parsed.bedrooms === 'number') updates.bedrooms = String(parsed.bedrooms);
    if (!form.bathrooms.trim() && typeof parsed.bathrooms === 'number') updates.bathrooms = String(parsed.bathrooms);
    if (!form.propertyType.trim() && parsed.propertyType) updates.propertyType = parsed.propertyType;
    if (!form.description.trim() && parsed.description) updates.description = parsed.description;

    if (Object.keys(updates).length === 0) {
      setExtractMessage('We could not detect much from that text. Please add the key fields manually.');
      return;
    }

    setForm((current) => ({ ...current, ...updates }));
    setExtractMessage('Details extracted. Please review before analysing.');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <section className="mx-auto max-w-7xl px-4 py-12 pb-32 sm:px-6 lg:px-8 lg:py-16 lg:pb-16">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
              <FiCheckCircle className="h-4 w-4" aria-hidden="true" />
              Analyse Any Deal
            </div>

            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                Analyse any UK property deal before you offer
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Paste a listing link, enter the key details, and PropNexus will generate an investor-ready Deal Pack.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                Start with a URL and a few key details. You can add more later.
              </p>
            </div>

            <InfoDisclaimer className="max-w-2xl">
              You provide the property information. PropNexus enriches it using available public, licensed and user-supplied data.
            </InfoDisclaimer>

            <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">What happens next</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  We create a user-submitted deal record, carry the listing URL as a reference only, and open the existing property detail workflow so you can review score, rent, offer logic and next steps in one place.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Investor-ready output</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Reuse the current detail page, score panels, offer intelligence and saved deal workflow.</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Reference URL only</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Source URLs are treated as user-provided references only and are never fetched here.</div>
                </div>
              </div>
              <div>
                <Link href="/listings" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
                  Browse current listings instead
                  <FiArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 sm:p-8">
            <form className="space-y-5" onSubmit={onSubmit}>
              <div>
                <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">Deal details</h2>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50/90 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <FiZap className="h-4 w-4 text-brand-500" aria-hidden="true" />
                  Speed up entry
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Paste the listing text or key details and PropNexus will pre-fill the form. The URL is stored as your reference only.
                </p>
                <div className="mt-4 space-y-4">
                  <FormField label="Listing/source URL optional" htmlFor="sourceUrl" error={fieldErrors.sourceUrl}>
                    <div className="relative">
                      <FiLink2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                      <input
                        id="sourceUrl"
                        name="sourceUrl"
                        type="url"
                        value={form.sourceUrl}
                        onChange={(event) => updateField('sourceUrl', event.target.value)}
                        placeholder="https://example.com/listing"
                        className={`${inputClassName} pl-11`}
                      />
                    </div>
                  </FormField>

                  <FormField label="Quick import text optional" htmlFor="listingText">
                    <textarea
                      id="listingText"
                      name="listingText"
                      rows={5}
                      value={form.listingText}
                      onChange={(event) => updateField('listingText', event.target.value)}
                      placeholder="Paste listing text, advert description, or key details..."
                      className={`${inputClassName} min-h-[8rem] py-3`}
                    />
                  </FormField>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={handleExtractDetails}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:border-brand-500 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:border-brand-500 dark:hover:text-brand-300"
                    >
                      Extract details
                    </button>
                    {extractMessage ? (
                      <p className="text-sm text-slate-600 dark:text-slate-300">{extractMessage}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Property title" htmlFor="title" error={fieldErrors.title}>
                  <input id="title" name="title" value={form.title} onChange={(event) => updateField('title', event.target.value)} className={inputClassName} />
                </FormField>
                <FormField label="Postcode" htmlFor="postcode" error={fieldErrors.postcode}>
                  <input id="postcode" name="postcode" value={form.postcode} onChange={(event) => updateField('postcode', event.target.value)} className={inputClassName} />
                </FormField>
              </div>

              <FormField label="Address/location" htmlFor="location" error={fieldErrors.location}>
                <input id="location" name="location" value={form.location} onChange={(event) => updateField('location', event.target.value)} className={inputClassName} />
              </FormField>

              <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                Listing URLs are treated as user-provided references only.
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Asking price" htmlFor="price" required error={fieldErrors.price}>
                  <input id="price" name="price" inputMode="decimal" value={form.price} onChange={(event) => updateField('price', event.target.value)} placeholder="250000" className={inputClassName} />
                </FormField>
                <FormField label="Property type" htmlFor="propertyType" error={fieldErrors.propertyType}>
                  <select id="propertyType" name="propertyType" value={form.propertyType} onChange={(event) => updateField('propertyType', event.target.value)} className={inputClassName}>
                    <option value="">Select property type</option>
                    {analysePropertyTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-200 p-4 dark:border-slate-700">
                <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Optional details</div>
                <div className="grid gap-5 sm:grid-cols-3">
                  <FormField label="Bedrooms" htmlFor="bedrooms" error={fieldErrors.bedrooms}>
                    <input id="bedrooms" name="bedrooms" inputMode="numeric" value={form.bedrooms} onChange={(event) => updateField('bedrooms', event.target.value)} className={inputClassName} />
                  </FormField>
                  <FormField label="Bathrooms" htmlFor="bathrooms" error={fieldErrors.bathrooms}>
                    <input id="bathrooms" name="bathrooms" inputMode="numeric" value={form.bathrooms} onChange={(event) => updateField('bathrooms', event.target.value)} className={inputClassName} />
                  </FormField>
                  <FormField label="Estimated monthly rent" htmlFor="estimatedMonthlyRent" error={fieldErrors.estimatedMonthlyRent}>
                    <input id="estimatedMonthlyRent" name="estimatedMonthlyRent" inputMode="decimal" value={form.estimatedMonthlyRent} onChange={(event) => updateField('estimatedMonthlyRent', event.target.value)} placeholder="1400" className={inputClassName} />
                  </FormField>
                </div>

                <div className="mt-5">
                  <FormField label="Notes/description" htmlFor="description" error={fieldErrors.description}>
                    <textarea
                      id="description"
                      name="description"
                      rows={5}
                      value={form.description}
                      onChange={(event) => updateField('description', event.target.value)}
                      className={`${inputClassName} min-h-[8rem] py-3`}
                    />
                  </FormField>
                </div>
              </div>

              <InfoDisclaimer className="w-full text-left">
                PropNexus does not scrape or copy third-party listing pages in this flow. Listing URLs are treated as user-provided references only. You are responsible for the information you provide. PropNexus outputs are indicative only and are not valuations, financial advice, mortgage advice, tax advice or legal advice.
              </InfoDisclaimer>

              {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:from-brand-600 hover:to-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span>{submitting ? 'Generating…' : 'Generate Deal Pack'}</span>
                <FiArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

function AnalysePageFallback() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="h-48 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}

export default function AnalysePage() {
  return (
    <Suspense fallback={<AnalysePageFallback />}>
      <AnalysePageClient />
    </Suspense>
  );
}

function FormField({
  label,
  htmlFor,
  required,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-2 block text-sm font-semibold text-slate-900 dark:text-white">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children}
      {error ? <span className="mt-2 block text-sm text-rose-600 dark:text-rose-300">{error}</span> : null}
    </label>
  );
}
