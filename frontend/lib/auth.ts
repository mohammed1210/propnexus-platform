import { hasValidClerkKey } from './clerk-utils';

/**
 * Single source of truth for whether Clerk auth is enabled.
 *
 * Important: this must match the gating used by Providers + any Clerk usage.
 */
export const isAuthEnabled: boolean =
  process.env.NEXT_PUBLIC_DISABLE_AUTH !== '1' &&
  hasValidClerkKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
