// frontend/components/ClerkAuthSafe.tsx
'use client';

import { ReactNode, useEffect, useState } from 'react';
import { SignedIn, SignedOut, UserButton, SignInButton, SignUpButton } from '@clerk/nextjs';

/**
 * Safe wrappers for Clerk components that won't break if Clerk isn't configured.
 * These components check if Clerk is available before rendering.
 */

// Check if we're in a Clerk context
function useClerkAvailable() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const enableClerk =
      !!pk &&
      pk.startsWith('pk_') &&
      !pk.toLowerCase().includes('dummy') &&
      pk.length > 30;

    setIsAvailable(enableClerk);
    setIsChecked(true);
  }, []);

  return { isAvailable, isChecked };
}

export function SafeSignedIn({ children }: { children: ReactNode }) {
  const { isAvailable, isChecked } = useClerkAvailable();

  if (!isChecked) return null;
  if (!isAvailable) return null;

  // Use static import - this maintains the React context from ClerkProvider
  return <SignedIn>{children}</SignedIn>;
}

export function SafeSignedOut({ children }: { children: ReactNode }) {
  const { isAvailable, isChecked } = useClerkAvailable();

  if (!isChecked) return null;

  if (!isAvailable) {
    // Show signed out content by default when Clerk isn't configured
    return <>{children}</>;
  }

  return <SignedOut>{children}</SignedOut>;
}

export function SafeUserButton(props: any) {
  const { isAvailable, isChecked } = useClerkAvailable();

  if (!isChecked) return null;
  if (!isAvailable) return null;

  return <UserButton {...props} />;
}

export function SafeSignInButton({ children, ...props }: any) {
  const { isAvailable, isChecked } = useClerkAvailable();

  if (!isChecked) return null;

  if (!isAvailable) {
    // Render children directly when Clerk isn't configured
    return <>{children}</>;
  }

  return <SignInButton {...props}>{children}</SignInButton>;
}

export function SafeSignUpButton({ children, ...props }: any) {
  const { isAvailable, isChecked } = useClerkAvailable();

  if (!isChecked) return null;

  if (!isAvailable) {
    // Render children directly when Clerk isn't configured
    return <>{children}</>;
  }

  return <SignUpButton {...props}>{children}</SignUpButton>;
}
