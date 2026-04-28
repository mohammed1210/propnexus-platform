// frontend/components/ClerkAuthSafe.tsx
'use client';

import { ReactNode } from 'react';
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from '@clerk/react';

import { isAuthEnabled } from '@/lib/auth';

export function SafeSignedIn({ children }: { children: ReactNode }) {
  if (!isAuthEnabled) return <>{children}</>;
  return <SignedInState>{children}</SignedInState>;
}

export function SafeSignedOut({ children }: { children: ReactNode }) {
  if (!isAuthEnabled) return <>{children}</>;
  return <SignedOutState>{children}</SignedOutState>;
}

function SignedInState({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded || !isSignedIn) return null;
  return <>{children}</>;
}

function SignedOutState({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded || isSignedIn) return null;
  return <>{children}</>;
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
