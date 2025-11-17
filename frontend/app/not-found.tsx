import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '404 - Page Not Found',
  description: 'The page you are looking for could not be found.',
};

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* 404 Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="text-9xl font-bold text-slate-200 dark:text-slate-800">
              404
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-24 h-24 text-brand-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Main Message */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Page Not Found
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Sorry, we couldn&apos;t find the page you&apos;re looking for.
          </p>
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <Link
            href="/"
            className="btn-primary px-6 py-3 text-base font-semibold"
          >
            Go Home
          </Link>
          <Link
            href="/demo"
            className="btn-ghost px-6 py-3 text-base font-semibold"
          >
            View Demo
          </Link>
          <Link
            href="/listings"
            className="btn-ghost px-6 py-3 text-base font-semibold"
          >
            Browse Listings
          </Link>
        </div>

        {/* Additional Help */}
        <div className="pt-8 border-t border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Need help?{' '}
            <Link
              href="/pricing"
              className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium"
            >
              View pricing
            </Link>
            {' or '}
            <a
              href="mailto:support@propnexus.com"
              className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium"
            >
              contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
