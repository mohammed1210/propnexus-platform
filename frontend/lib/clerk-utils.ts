/**
 * Utility for validating Clerk publishable keys.
 * Used by both middleware and providers to ensure consistent validation.
 */

// Minimum length for a valid Clerk publishable key
const MIN_CLERK_KEY_LENGTH = 25;

/**
 * Checks if a Clerk publishable key is valid.
 * @param pk - The publishable key to validate
 * @returns true if the key has a valid format (pk_test_* or pk_live_*) and sufficient length
 */
export function hasValidClerkKey(pk?: string): boolean {
  return Boolean(
    pk && 
    (pk.startsWith("pk_test_") || pk.startsWith("pk_live_")) && 
    pk.length > MIN_CLERK_KEY_LENGTH
  );
}
