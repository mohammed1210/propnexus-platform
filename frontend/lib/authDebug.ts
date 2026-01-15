import { auth, clerkClient } from '@clerk/nextjs/server';
import { disableAuth, disableAuthRaw, isAuthEnabled } from '@/lib/auth';
import { hasValidClerkKey } from '@/lib/clerk-utils';

export type AuthDebugPayload = {
  disableAuthRaw: string;
  disableAuthParsed: boolean;
  isAuthEnabled: boolean;
  clerk: {
    hasPublishableKey: boolean;
    hasValidPublishableKey: boolean;
    hasSecretKey: boolean;
    signInUrl: string | null;
    signUpUrl: string | null;
    afterSignInUrl: string | null;
    afterSignUpUrl: string | null;
  };
  whoami: {
    userId: string | null;
    sessionId: string | null;
    email: string | null;
    error?: string;
  };
};

export async function buildAuthDebugPayload(): Promise<AuthDebugPayload> {
  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  const secret = process.env.CLERK_SECRET_KEY ?? '';

  const whoami: AuthDebugPayload['whoami'] = {
    userId: null,
    sessionId: null,
    email: null,
  };

  if (isAuthEnabled && secret) {
    try {
      const a = await auth();
      whoami.userId = a.userId ?? null;
      whoami.sessionId = a.sessionId ?? null;

      if (a.userId) {
        const client = await clerkClient();
        const user = await client.users.getUser(a.userId);
        whoami.email =
          user.primaryEmailAddress?.emailAddress ??
          user.emailAddresses?.[0]?.emailAddress ??
          null;
      }
    } catch (err: any) {
      whoami.error = err?.message || 'Failed to load Clerk auth';
    }
  }

  return {
    disableAuthRaw,
    disableAuthParsed: disableAuth,
    isAuthEnabled,
    clerk: {
      hasPublishableKey: Boolean(publishable),
      hasValidPublishableKey: hasValidClerkKey(publishable),
      hasSecretKey: Boolean(secret),
      signInUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? null,
      signUpUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? null,
      afterSignInUrl: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL ?? null,
      afterSignUpUrl: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL ?? null,
    },
    whoami,
  };
}
