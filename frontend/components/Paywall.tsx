"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Simple client-side paywall for UX gating.
 * Real enforcement should happen on the server.
 */
export default function Paywall({ children }: { children: React.ReactNode }) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    const paid = localStorage.getItem('paid');
    setHasAccess(paid === 'true');
  }, []);

  if (hasAccess === null) return null;

  if (!hasAccess) {
    return (
      <div className="p-6 border rounded bg-yellow-50 text-yellow-800">
        <h2 className="text-xl font-semibold mb-2">Premium Feature</h2>
        <p className="mb-4">This feature is available on our paid plan.</p>
        <Link href="/pricing" className="underline text-blue-600">Upgrade</Link>
      </div>
    );
  }

  return <>{children}</>;
}
