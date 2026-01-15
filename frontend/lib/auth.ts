import { hasValidClerkKey } from './clerk-utils';

/**
 * Single source of truth for whether Clerk auth is enabled.
 *
 * Important: this must match the gating used by Providers + any Clerk usage.
 */
export const disableAuthRaw = (process.env.NEXT_PUBLIC_DISABLE_AUTH ?? '')
  .trim()
  .toLowerCase();
export const disableAuth = ['1', 'true', 'yes', 'on'].includes(disableAuthRaw);

export const isAuthEnabled: boolean =
  !disableAuth && hasValidClerkKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
