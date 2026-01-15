// frontend/components/ClerkAuthSafe.tsx
'use client';

import { ReactNode } from 'react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from '@clerk/nextjs';

import { isAuthEnabled } from '@/lib/auth';

export function SafeSignedIn({ children }: { children: ReactNode }) {
  if (!isAuthEnabled) return <>{children}</>;
  return <SignedIn>{children}</SignedIn>;
}

export function SafeSignedOut({ children }: { children: ReactNode }) {
  if (!isAuthEnabled) return <>{children}</>;
  return <SignedOut>{children}</SignedOut>;
}

export function SafeUserButton(props: any) {
  if (!isAuthEnabled) return null;
  return <UserButton {...props} />;
}

export function SafeSignInButton({ children, ...props }: any) {
  if (!isAuthEnabled) {
    // Render children directly when auth is disabled.
    return <>{children}</>;
  }
  return <SignInButton {...props}>{children}</SignInButton>;
}

export function SafeSignUpButton({ children, ...props }: any) {
  if (!isAuthEnabled) {
    // Render children directly when auth is disabled.
    return <>{children}</>;
  }
  return <SignUpButton {...props}>{children}</SignUpButton>;
}
