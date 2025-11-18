import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { FiHome, FiMapPin, FiDollarSign, FiTrendingUp, FiBarChart2, FiTool, FiStar } from 'react-icons/fi';
import { getDemoPropertyBySlug, type DemoProperty } from '@/data/demo-properties';

export const metadata: Metadata = {
  robots: 'noindex, nofollow',
  title: 'Demo Property Details - PropNexus',
  description: 'Preview premium property features with sample data',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DemoPropertyPage({ params }: PageProps) {
  const { id } = await params;
  const property = getDemoPropertyBySlug(id);

  if (!property) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
      {/* Demo Banner */}
      <div className="bg-brand-600 dark:bg-brand-700 text-white py-3 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm sm:text-base">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
            </svg>
            <span className="font-medium">Demo Preview - Read-only Mode</span>
          </div>
          <Link
            href="/magic-login"
            className="px-4 py-2 bg-white text-brand-600 rounded-lg font-semibold text-sm hover:bg-slate-100 transition-colors"
          >
            Sign in to explore live insights
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Property Header & Hero */}
        <div className="card mb-8 p-0 overflow-hidden">
          {/* Hero Image */}
          <div className="relative w-full h-64 sm:h-96 bg-slate-200 dark:bg-slate-800">
            <Image
              src={property.image}
              alt={property.title}
              fill
              style={{ objectFit: 'cover' }}
              className="opacity-90"
              onError={(e) => {
                // Fallback to placeholder if image doesn't exist
                e.currentTarget.src = '/images/fallback-property.png';
              }}
            />
            <div className="absolute top-4 right-4">
              <span className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold text-sm shadow-lg">
                £{property.price.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Property Info */}
          <div className="p-6">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-3">
              {property.title}
            </h1>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-6">
              <FiMapPin className="w-5 h-5" />
              <span className="text-lg">{property.address}</span>
            </div>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <FiHome className="w-5 h-5 text-brand-500" />
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {property.beds} beds
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FiHome className="w-5 h-5 text-brand-500" />
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {property.baths} baths
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FiHome className="w-5 h-5 text-brand-500" />
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {property.sqft.toLocaleString()} sqft
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* AI Deal Score */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
                <FiDollarSign className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                AI Deal Score
              </h2>
            </div>

            {/* Score Display */}
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <svg className="w-48 h-48 transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-slate-200 dark:text-slate-800"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 88}`}
                    strokeDashoffset={`${2 * Math.PI * 88 * (1 - property.premium.dealScore / 100)}`}
                    className="text-brand-500 dark:text-brand-400"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-bold text-slate-900 dark:text-white" aria-label={`Deal score: ${property.premium.dealScore} out of 100`}>
                    {property.premium.dealScore}
                  </span>
                  <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                    / 100
                  </span>
                </div>
              </div>
            </div>

            {/* Score Explanation */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Score based on:
              </p>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-brand-500 mt-0.5">•</span>
                  <span>Strong rental yield potential ({property.premium.investmentAnalytics.capRate}% cap rate)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-500 mt-0.5">•</span>
                  <span>Excellent area metrics (schools rated {property.premium.areaIntel.schoolRating}/10)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-500 mt-0.5">•</span>
                  <span>Positive rent growth trend ({property.premium.areaIntel.rentGrowthYoY}% YoY)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-500 mt-0.5">•</span>
                  <span>Low crime index for safer investment</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Area Intel */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
                <FiMapPin className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Area Intelligence
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Crime Index
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {property.premium.areaIntel.crimeIndex}
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  School Rating
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {property.premium.areaIntel.schoolRating}/10
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Walk Score
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {property.premium.areaIntel.walkScore}
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Rent Growth (YoY)
                </div>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  +{property.premium.areaIntel.rentGrowthYoY}%
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg sm:col-span-2">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Median Days on Market
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {property.premium.areaIntel.domMedian} days
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Investment Analytics */}
        <div className="card p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
              <FiBarChart2 className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Investment Analytics
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div className="p-4 bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-800/20 rounded-lg border border-brand-200 dark:border-brand-800">
              <div className="text-sm text-brand-700 dark:text-brand-300 mb-1 font-medium">
                Cap Rate
              </div>
              <div className="text-2xl font-bold text-brand-900 dark:text-white">
                {property.premium.investmentAnalytics.capRate}%
              </div>
            </div>

            <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div className="text-sm text-emerald-700 dark:text-emerald-300 mb-1 font-medium">
                Cash-on-Cash
              </div>
              <div className="text-2xl font-bold text-emerald-900 dark:text-white">
                {property.premium.investmentAnalytics.cocReturn}%
              </div>
            </div>

            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-sm text-blue-700 dark:text-blue-300 mb-1 font-medium">
                IRR (5y)
              </div>
              <div className="text-2xl font-bold text-blue-900 dark:text-white">
                {property.premium.investmentAnalytics.irr5y}%
              </div>
            </div>

            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-sm text-purple-700 dark:text-purple-300 mb-1 font-medium">
                Break-even Occ.
              </div>
              <div className="text-2xl font-bold text-purple-900 dark:text-white">
                {property.premium.investmentAnalytics.breakevenOcc}%
              </div>
            </div>

            <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="text-sm text-amber-700 dark:text-amber-300 mb-1 font-medium">
                Monthly Cashflow
              </div>
              <div className="text-2xl font-bold text-amber-900 dark:text-white">
                £{property.premium.investmentAnalytics.monthlyCashflow}
              </div>
            </div>
          </div>
        </div>

        {/* Local Tradesmen */}
        <div className="card p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
              <FiTool className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Local Tradesmen & Services
            </h2>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Connect with qualified local professionals for your property project
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {property.premium.tradesmen.map((tradesman, index) => (
              <div
                key={index}
                className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-brand-500 dark:hover:border-brand-500 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                      {tradesman.name}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {tradesman.service}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1">
                    <FiStar className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {tradesman.rating}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    ETA: {tradesman.eta}
                  </div>
                </div>

                <a
                  href={`tel:${tradesman.phone}`}
                  className="block w-full px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-center rounded-lg font-medium text-sm transition-colors"
                >
                  Call {tradesman.phone}
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="card p-8 text-center bg-gradient-to-br from-brand-50 to-slate-50 dark:from-brand-900/20 dark:to-slate-900/20 border-2 border-brand-200 dark:border-brand-800">
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Ready to Explore Live Property Data?
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Sign in to access real properties, personalized analytics, and exclusive investment opportunities
            </p>
            <Link
              href="/magic-login"
              className="inline-flex items-center gap-2 px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold text-lg transition-colors"
            >
              Sign in to explore live insights
              <FiTrendingUp className="w-5 h-5" />
            </Link>
            <p className="text-sm text-slate-500 dark:text-slate-400 pt-2">
              No credit card required · Full access for 14 days
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
