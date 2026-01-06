/**
 * Utility functions for Clerk configuration
 */

/**
 * Check if a valid Clerk publishable key is configured
 * @param pk - The publishable key to validate
 * @returns true if the key is valid (starts with pk_test_ or pk_live_)
 */
export function isValidClerkKey(pk?: string): pk is string {
  return !!(pk && (pk.startsWith("pk_test_") || pk.startsWith("pk_live_")));
}
