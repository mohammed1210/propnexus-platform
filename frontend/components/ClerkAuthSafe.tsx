// frontend/components/ClerkAuthSafe.tsx
'use client';

import { ReactNode } from 'react';
import { isAuthEnabled } from '@/lib/auth';

/**
 * Safe wrappers for Clerk components that won't break if Clerk isn't configured
 * OR if auth is intentionally disabled.
 */

function getClerk() {
  if (!isAuthEnabled) return null;
  return require('@clerk/nextjs') as typeof import('@clerk/nextjs');
}

export function SafeSignedIn({ children }: { children: ReactNode }) {
  const clerk = getClerk();
  if (!clerk) return null;
  const { SignedIn } = clerk;
  return <SignedIn>{children}</SignedIn>;
}

export function SafeSignedOut({ children }: { children: ReactNode }) {
  const clerk = getClerk();
  if (!clerk) {
    // If auth is disabled, treat users as signed out.
    return <>{children}</>;
  }
  const { SignedOut } = clerk;
  return <SignedOut>{children}</SignedOut>;
}

export function SafeUserButton(props: any) {
  const clerk = getClerk();
  if (!clerk) return null;
  const { UserButton } = clerk;
  return <UserButton {...props} />;
}

export function SafeSignInButton({ children, ...props }: any) {
  const clerk = getClerk();
  if (!clerk) {
    // Render children directly when auth is disabled.
    return <>{children}</>;
  }
  const { SignInButton } = clerk;
  return <SignInButton {...props}>{children}</SignInButton>;
}

export function SafeSignUpButton({ children, ...props }: any) {
  const clerk = getClerk();
  if (!clerk) {
    // Render children directly when auth is disabled.
    return <>{children}</>;
  }
  const { SignUpButton } = clerk;
  return <SignUpButton {...props}>{children}</SignUpButton>;
}
