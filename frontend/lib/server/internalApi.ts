export const INTERNAL_API_TOKEN_HEADER = 'X-PropNexus-Internal-Token';
const INTERNAL_API_CONFIG_ERROR = 'Internal API server configuration is incomplete.';

export class InternalApiConfigError extends Error {
  constructor() {
    super(INTERNAL_API_CONFIG_ERROR);
    this.name = 'InternalApiConfigError';
  }
}

export function isInternalApiConfigError(error: unknown): boolean {
  return error instanceof Error && error.message === INTERNAL_API_CONFIG_ERROR;
}

export function internalApiHeaders(): Record<string, string> {
  const token = (process.env.PROPNEXUS_INTERNAL_API_TOKEN ?? '').trim();
  if (!token) {
    throw new InternalApiConfigError();
  }
  return { [INTERNAL_API_TOKEN_HEADER]: token };
}
