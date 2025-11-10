'use client';

import { Suspense } from 'react';
import OffMarketContent from './OffMarketContent';

/**
 * Off-Market Deals Page - Private deals and AI-generated opportunities
 */
export default function OffMarketPage() {
  return (
    <Suspense fallback={<OffMarketPageSkeleton />}>
      <OffMarketContent />
    </Suspense>
  );
}

function OffMarketPageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-[1920px] mx-auto px-4 py-6">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse mb-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" />
        </div>
        
        {/* Generator skeleton */}
        <div className="mb-6 h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
        
        {/* Content skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-80 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
