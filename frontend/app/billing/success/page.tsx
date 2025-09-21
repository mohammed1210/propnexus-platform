'use client';

import Link from 'next/link';

export default function BillingSuccessPage() {
  return (
    <main className="max-w-2xl mx-auto py-16 text-center">
      <h1 className="text-2xl font-bold mb-4 text-green-600">✅ Payment Successful</h1>
      <p className="mb-6">
        Thank you for your purchase! Your subscription is now active.
      </p>
      <div className="flex justify-center gap-4">
        <Link href="/off-market" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Go to Investor Dashboard
        </Link>
        <Link href="/" className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700">
          Return Home
        </Link>
      </div>
    </main>
  );
}
