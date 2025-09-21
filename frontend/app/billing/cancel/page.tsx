'use client';

import Link from 'next/link';

export default function BillingCancelPage() {
  return (
    <main className="max-w-2xl mx-auto py-16 text-center">
      <h1 className="text-2xl font-bold mb-4 text-red-600">❌ Payment Cancelled</h1>
      <p className="mb-6">It looks like your payment was cancelled. No charges were made.</p>
      <div className="flex justify-center gap-4">
        <Link href="/pricing" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Try Again
        </Link>
        <Link href="/" className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700">
          Return Home
        </Link>
      </div>
    </main>
  );
}
