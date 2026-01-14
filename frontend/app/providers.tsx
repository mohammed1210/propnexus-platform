'use client';

import React from 'react';
import { isAuthEnabled } from '@/lib/auth';

export default function Providers({ children }: { children: React.ReactNode }) {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // ✅ CI / preview / local builds without Clerk keys
  if (!isAuthEnabled || !pk) {
    return <>{children}</>;
  }

  // ✅ Only load Clerk when actually enabled
  const { ClerkProvider } = require('@clerk/nextjs') as typeof import('@clerk/nextjs');

  return <ClerkProvider publishableKey={pk}>{children}</ClerkProvider>;
}
