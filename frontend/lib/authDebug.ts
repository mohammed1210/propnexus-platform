import { auth, clerkClient } from '@clerk/nextjs/server';
import { disableAuth, disableAuthRaw, isAuthEnabled } from '@/lib/auth';
import { hasValidClerkKey } from '@/lib/clerk-utils';

export type AuthDebugPayload = {
  disableAuthRaw: string;
  disableAuthParsed: boolean;
  /**
   * Server-effective flag (used for debug + server-only Clerk operations).
   * Requires publishable key + CLERK_SECRET_KEY.
   */
  isAuthEnabled: boolean;
  /**
   * Client gating flag (keeps existing UI + Providers behavior).
   */
  isAuthEnabledClient: boolean;
  vercelEnv: string | null;
  commitSha: string | null;
  clerk: {
    hasPublishableKey: boolean;
    hasValidPublishableKey: boolean;
    publishableKeyPrefix: string | null;
    publishableKeyLength: number;
    publishableKeyHasWhitespace: boolean;
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
  const publishableRaw = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  const publishable = publishableRaw.trim();
  const secret = (process.env.CLERK_SECRET_KEY ?? '').trim();

  const hasPublishableKey = Boolean(publishable);
  const hasPublishableWhitespace = publishableRaw !== publishable;
  const hasValidPublishableKey = hasValidClerkKey(publishable);
  const hasSecretKey = Boolean(secret);

  const isAuthEnabledClient = isAuthEnabled;
  const isAuthEnabledServer = !disableAuth && hasValidPublishableKey && hasSecretKey;

  const whoami: AuthDebugPayload['whoami'] = {
    userId: null,
    sessionId: null,
    email: null,
  };

  if (isAuthEnabledServer) {
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
    isAuthEnabled: isAuthEnabledServer,
    isAuthEnabledClient,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    clerk: {
      hasPublishableKey,
      hasValidPublishableKey,
      publishableKeyPrefix: publishable ? publishable.slice(0, 6) : null,
      publishableKeyLength: publishable.length,
      publishableKeyHasWhitespace: hasPublishableWhitespace,
      hasSecretKey,
      signInUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? null,
      signUpUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? null,
      afterSignInUrl: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL ?? null,
      afterSignUpUrl: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL ?? null,
    },
    whoami,
  };
}
