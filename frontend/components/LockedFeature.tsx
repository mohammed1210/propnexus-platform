'use client';

import Link from 'next/link';
import { FiLock } from 'react-icons/fi';

type LockedFeatureProps = {
  /** Title shown in the header */
  title: string;
  /** Plan required to unlock (e.g., "Pro" or "Investor") */
  requiredPlan: 'Pro' | 'Investor';
  /** Optional custom message */
  message?: string;
  /** Children shown blurred/minimized when locked */
  children?: React.ReactNode;
};

export default function LockedFeature({
  title,
  requiredPlan,
  message,
  children,
}: LockedFeatureProps) {
  const defaultMessage = `Upgrade to ${requiredPlan} to unlock this feature`;

  return (
    <div className="relative">
      {/* Blurred content preview */}
      {children && (
        <div
          className="relative overflow-hidden pointer-events-none"
          style={{ maxHeight: '140px' }}
          aria-hidden="true"
        >
          <div className="blur-sm opacity-40 select-none">{children}</div>
          {/* Fade gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white dark:to-zinc-900"></div>
        </div>
      )}

      {/* Locked overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center p-6 space-y-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-lg border-2 border-dashed border-gray-300 dark:border-zinc-700">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg">
          <FiLock className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-1">{title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {message || defaultMessage}
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 text-white font-medium hover:from-brand-400 hover:to-brand-500 transition-all shadow-md hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label={`View pricing plans to unlock ${title}`}
          >
            View Pricing
          </Link>
          <Link
            href="/account"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
            aria-label="Manage your subscription plan"
          >
            Manage Plan
          </Link>
        </div>
      </div>
    </div>
  );
}
