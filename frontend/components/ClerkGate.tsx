'use client';

import * as React from 'react';
import { ClerkProvider } from '@clerk/nextjs';

function isValidClerkPk(pk?: string) {
  if (!pk) return false;

  // Accept both test and live publishable keys, but avoid obvious CI dummy values.
  // Keep in sync with app/providers.tsx gating.
  return pk.startsWith('pk_') && !pk.toLowerCase().includes('dummy') && pk.length > 30;
}

export default function ClerkGate({ children }: { children: React.ReactNode }) {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // ✅ If no valid key, do NOT mount Clerk at all (prevents prerender crash)
  if (!isValidClerkPk(pk)) return <>{children}</>;

  return <ClerkProvider publishableKey={pk}>{children}</ClerkProvider>;
}
