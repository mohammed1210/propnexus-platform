/**
 * Utility for validating Clerk publishable keys.
 *
 * This must be robust across environments (local/preview/prod) and should NOT
 * be overly strict (length/pattern assumptions can differ across Clerk tenants).
 *
 * Minimum safe validation (as requested):
 * - string
 * - trimmed
 * - starts with "pk_" (covers pk_test_*, pk_live_*, etc)
 * - length > 20
 * - no whitespace
 */

const MIN_CLERK_KEY_LENGTH = 21;

export function hasValidClerkKey(pk?: string): boolean {
  if (typeof pk !== 'string') return false;

  const trimmed = pk.trim();
  if (!trimmed) return false;

  if (!trimmed.startsWith('pk_')) return false;
  if (trimmed.length < MIN_CLERK_KEY_LENGTH) return false;
  if (/\s/.test(trimmed)) return false;

  return true;
}
