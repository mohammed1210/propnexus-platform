import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import { GalleryImage } from '@/components/GalleryImage';
import { DEMO_PREMIUM_FEATURES, DEMO_SAMPLE_PROPERTIES } from '@/lib/demoContent';
import { formatPercent, getRoiDisplay, getYieldPercent } from '@/lib/normalizeProperty';

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: 'Demo - PropNexus Platform',
  description: 'Explore PropNexus features with sample property data and analytics.',
};

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
      {/* Hero Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-100 dark:bg-brand-900/30 rounded-full text-brand-600 dark:text-brand-400 text-sm font-medium">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
            </svg>
            Public Demo - No Sign-up Required
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white">
            Welcome to <span className="text-brand-600 dark:text-brand-400">PropNexus</span>
          </h1>

          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
            Discover AI-powered property investment insights. Browse sample properties below
            to see our analytics in action.
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Link
              href="/magic-login"
              className="btn-primary px-8 py-3 text-lg font-semibold"
            >
              Get Started Free
            </Link>
            <Link
              href="/pricing"
              className="btn-ghost px-8 py-3 text-lg font-semibold"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Sample Properties Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Sample Investment Properties
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Curated from live property records so the preview cards use real listing photos and metrics
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DEMO_SAMPLE_PROPERTIES.map((property) => (
              <div
                key={property.id}
                className="card p-0 overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Property Image */}
                <div className="relative w-full h-48 bg-slate-200 dark:bg-slate-800">
                  <Image
                    src={property.imageurl}
                    alt={property.title}
                    fill
                    unoptimized
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    style={{ objectFit: 'cover' }}
                    className="opacity-90"
                  />
                  <div className="absolute top-2 right-2 flex flex-col gap-1">
                    <span className="text-xs font-semibold px-2 py-1 rounded-md bg-slate-900/85 text-white">
                      {Math.round(property.score)}/100 Score
                    </span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-md bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                      {formatPercent(getYieldPercent(property as any))} Yield
                    </span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {(() => {
                        const roi = getRoiDisplay(property as any);
                        const base = formatPercent(roi.value);
                        return `${base} ROI${roi.isProxy ? ' (proxy)' : ''}`;
                      })()}
                    </span>
                  </div>
                </div>

                {/* Property Details */}
                <div className="p-4 space-y-3">
                  <h3 className="font-semibold text-lg leading-snug line-clamp-2">
                    {property.title}
                  </h3>

                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    📍 {property.location} · {property.postcode}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="text-sm">
                      <span className="font-semibold text-lg">
                        £{property.price.toLocaleString()}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400 ml-2">
                        {property.bedrooms} bd · {property.bathrooms} ba
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>Source: {property.source}</span>
                      <Link href={`/property/${property.id}`} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
                        Open detail page
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Premium Features Preview Gallery */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-900/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Premium Features Preview
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Real captures from working property detail sections that are live in the product today
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
            {DEMO_PREMIUM_FEATURES.map((feature) => (
              <GalleryImage
                key={feature.title}
                src={feature.src}
                alt={feature.alt}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Features Overview */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-100 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Powerful Investment Tools
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Everything you need to find and analyze property investments
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="card text-center space-y-4">
              <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/30 rounded-xl flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                Investment Analytics
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Calculate yield, ROI, cashflow, and more with our advanced calculators
              </p>
            </div>

            <div className="card text-center space-y-4">
              <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/30 rounded-xl flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                AI Deal Scoring
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Get AI-powered investment scores and recommendations for every property
              </p>
            </div>

            <div className="card text-center space-y-4">
              <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/30 rounded-xl flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                Area Intelligence
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Access demographics, crime data, and local market insights
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            Ready to Find Your Next Investment?
          </h2>
          <p className="text-xl text-slate-600 dark:text-slate-400">
            Join hundreds of investors using PropNexus to source and analyze property deals
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/magic-login"
              className="btn-primary px-8 py-3 text-lg font-semibold"
            >
              Start Free Trial
            </Link>
            <Link
              href="/listings"
              className="btn-ghost px-8 py-3 text-lg font-semibold"
            >
              Browse Real Properties
            </Link>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No credit card required · Full access for 14 days
          </p>
        </div>
      </section>
    </div>
  );
}
