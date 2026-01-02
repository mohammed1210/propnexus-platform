'use client';

import * as React from 'react';
import { ClerkProvider } from '@clerk/nextjs';

function isValidClerkPk(pk?: string) {
  if (!pk) return false;
  // Accept both test and live publishable keys.
  return pk.startsWith('pk_test_') || pk.startsWith('pk_live_');
}

export default function ClerkGate({ children }: { children: React.ReactNode }) {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // ✅ If no valid key, do NOT mount Clerk at all (prevents prerender crash)
  if (!isValidClerkPk(pk)) return <>{children}</>;

  return <ClerkProvider publishableKey={pk}>{children}</ClerkProvider>;
}
