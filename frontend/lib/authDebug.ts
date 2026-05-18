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
    publishableKeyHasWhitespace: boolean;
    hasSecretKey: boolean;
    hasSignInUrl: boolean;
    hasSignUpUrl: boolean;
    hasAfterSignInUrl: boolean;
    hasAfterSignUpUrl: boolean;
  };
  whoami: {
    hasUserId: boolean;
    hasSessionId: boolean;
    hasEmail: boolean;
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
    hasUserId: false,
    hasSessionId: false,
    hasEmail: false,
  };

  if (isAuthEnabledServer) {
    try {
      const a = await auth();
      whoami.hasUserId = Boolean(a.userId);
      whoami.hasSessionId = Boolean(a.sessionId);

      if (a.userId) {
        const client = await clerkClient();
        const user = await client.users.getUser(a.userId);
        whoami.hasEmail = Boolean(user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress);
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
      publishableKeyHasWhitespace: hasPublishableWhitespace,
      hasSecretKey,
      hasSignInUrl: Boolean(process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL),
      hasSignUpUrl: Boolean(process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL),
      hasAfterSignInUrl: Boolean(process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL),
      hasAfterSignUpUrl: Boolean(process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL),
    },
    whoami,
  };
}
