export const INTERNAL_API_TOKEN_HEADER = 'X-PropNexus-Internal-Token';

export function internalApiHeaders(): Record<string, string> {
  const token = (process.env.PROPNEXUS_INTERNAL_API_TOKEN ?? '').trim();
  if (!token) {
    throw new Error('Internal API token is not configured.');
  }
  return { [INTERNAL_API_TOKEN_HEADER]: token };
}
