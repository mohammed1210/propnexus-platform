// frontend/components/ClerkAuthSafe.tsx
'use client';

import { ReactNode, useEffect, useState } from 'react';

/**
 * Safe wrappers for Clerk components that won't break if Clerk isn't configured.
 * These components check if Clerk is available before rendering.
 */

// Check if we're in a Clerk context
function useClerkAvailable() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    // Check if Clerk publishable key is set
    const hasClerkKey = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    setIsAvailable(hasClerkKey);
    setIsChecked(true);
  }, []);

  return { isAvailable, isChecked };
}

export function SafeSignedIn({ children }: { children: ReactNode }) {
  const { isAvailable, isChecked } = useClerkAvailable();
  
  if (!isChecked) return null;
  if (!isAvailable) return null;

  // Dynamically import Clerk component only if available
  const { SignedIn } = require('@clerk/nextjs');
  return <SignedIn>{children}</SignedIn>;
}

export function SafeSignedOut({ children }: { children: ReactNode }) {
  const { isAvailable, isChecked } = useClerkAvailable();
  
  if (!isChecked) return null;
  
  if (!isAvailable) {
    // Show signed out content by default when Clerk isn't configured
    return <>{children}</>;
  }

  const { SignedOut } = require('@clerk/nextjs');
  return <SignedOut>{children}</SignedOut>;
}

export function SafeUserButton(props: any) {
  const { isAvailable, isChecked } = useClerkAvailable();
  
  if (!isChecked) return null;
  if (!isAvailable) return null;

  const { UserButton } = require('@clerk/nextjs');
  return <UserButton {...props} />;
}

export function SafeSignInButton({ children, ...props }: any) {
  const { isAvailable, isChecked } = useClerkAvailable();
  
  if (!isChecked) return null;
  
  if (!isAvailable) {
    // Render children directly when Clerk isn't configured
    return <>{children}</>;
  }

  const { SignInButton } = require('@clerk/nextjs');
  return <SignInButton {...props}>{children}</SignInButton>;
}

export function SafeSignUpButton({ children, ...props }: any) {
  const { isAvailable, isChecked } = useClerkAvailable();
  
  if (!isChecked) return null;
  
  if (!isAvailable) {
    // Render children directly when Clerk isn't configured
    return <>{children}</>;
  }

  const { SignUpButton } = require('@clerk/nextjs');
  return <SignUpButton {...props}>{children}</SignUpButton>;
}
