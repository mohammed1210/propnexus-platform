'use client';

import { Suspense } from 'react';
import ListingsContent from './ListingsContent';

/**
 * Listings Page - Property search and discovery
 * 
 * This page provides a comprehensive property listing interface with:
 * - Advanced filtering capabilities
 * - Interactive map view
 * - Responsive grid/list layouts
 * - Real-time search
 */
export default function ListingsPage() {
  return (
    <Suspense fallback={<ListingsPageSkeleton />}>
      <ListingsContent />
    </Suspense>
  );
}

function ListingsPageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-[1920px] mx-auto px-4 py-6">
        {/* Filter skeleton */}
        <div className="mb-6 space-y-4">
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-11 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
        
        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="hidden lg:block h-[600px] bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
