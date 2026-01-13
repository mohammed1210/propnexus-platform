'use client';

import React from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === '1';
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // ✅ CI / preview / local builds without Clerk keys
  if (authDisabled || !pk) {
    return <>{children}</>;
  }

  // ✅ Only load Clerk when actually enabled
  const { ClerkProvider } = require('@clerk/nextjs') as typeof import('@clerk/nextjs');

  return <ClerkProvider publishableKey={pk}>{children}</ClerkProvider>;
}
