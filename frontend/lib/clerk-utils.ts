/**
 * Utility for validating Clerk publishable keys.
 * Used by both middleware and providers to ensure consistent validation.
 *
 * Goal:
 * - Treat obvious placeholders as INVALID (so CI doesn't mount Clerk).
 * - Only treat real-looking pk_test_/pk_live_ keys as VALID.
 */

// Clerk publishable keys are typically quite long.
// 25 is too low and can accidentally allow placeholders.
const MIN_CLERK_KEY_LENGTH = 60;

// Common placeholder markers we want to reject
const INVALID_SUBSTRINGS = [
  "placeholder",
  "dummy",
  "example",
  "changeme",
  "your_",
  "pk_test_012345",
  "pk_live_012345",
];

function looksLikeClerkPrefix(pk: string) {
  return pk.startsWith("pk_test_") || pk.startsWith("pk_live_");
}

function containsInvalidMarker(pkLower: string) {
  return INVALID_SUBSTRINGS.some((s) => pkLower.includes(s));
}

/**
 * Checks if a Clerk publishable key is valid.
 * @param pk - The publishable key to validate
 * @returns true if the key has a valid format (pk_test_* or pk_live_*) and sufficient length,
 *          and does not look like a placeholder.
 */
export function hasValidClerkKey(pk?: string): boolean {
  if (!pk) return false;

  const trimmed = pk.trim();
  const lower = trimmed.toLowerCase();

  if (!looksLikeClerkPrefix(trimmed)) return false;
  if (trimmed.length < MIN_CLERK_KEY_LENGTH) return false;
  if (containsInvalidMarker(lower)) return false;

  // Extra sanity: avoid keys with spaces/newlines
  if (/\s/.test(trimmed)) return false;

  return true;
}
