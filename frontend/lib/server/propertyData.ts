import { auth } from '@clerk/nextjs/server';

export function getBackendBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    ''
  ).replace(/\/+$/, '');
}

export async function backendFetch(path: string, init?: RequestInit) {
  const base = getBackendBaseUrl();
  if (!base) {
    throw new Error('Missing BACKEND base URL env (NEXT_PUBLIC_BACKEND_URL / BACKEND_URL / NEXT_PUBLIC_API_BASE).');
  }

  const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  return fetch(url, { ...init, cache: 'no-store' });
}

export async function getOptionalClerkUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    return userId ?? null;
  } catch {
    return null;
  }
}

export async function fetchPropertyById(propertyId: string, userId?: string | null): Promise<Record<string, unknown> | null> {
  const res = await backendFetch(`/properties/${encodeURIComponent(propertyId)}`, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      ...(userId ? { 'x-clerk-user-id': userId } : {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to load property (${res.status})`);
  }

  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}
