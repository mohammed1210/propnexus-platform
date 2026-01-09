/**
 * Utility for validating Clerk publishable keys.
 * Used by both middleware and Providers to ensure CI-safe behaviour.
 */

/**
 * Strict Clerk publishable key validation.
 *
 * Accepts ONLY real-looking keys:
 *   - pk_test_*
 *   - pk_live_*
 *
 * Prevents Next.js prerender/build crashes in CI caused by
 * placeholder, dummy, or truncated keys.
 */
export function hasValidClerkKey(pk?: string): boolean {
  if (!pk) return false;

  // Reject obvious placeholders / CI fallbacks
  if (
    pk.includes("placeholder") ||
    pk.includes("dummy") ||
    pk.includes("example") ||
    pk.endsWith("_")
  ) {
    return false;
  }

  // Clerk publishable keys are long, URL-safe, and prefixed
  // This regex intentionally errs on the side of safety
  return /^(pk_test_|pk_live_)[A-Za-z0-9_]{20,}$/.test(pk);
}
