import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
} as const;

function getBackendBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    ''
  ).replace(/\/+$/, '');
}

async function backendFetch(path: string, init?: RequestInit) {
  const base = getBackendBaseUrl();
  if (!base) {
    throw new Error('Missing BACKEND base URL env (NEXT_PUBLIC_BACKEND_URL / BACKEND_URL / NEXT_PUBLIC_API_BASE).');
  }
  const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  return fetch(url, { ...init, cache: 'no-store' });
}

export async function GET(_req: Request, ctx: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await ctx.params;

  try {
    const { userId } = await auth();

    const res = await backendFetch(`/properties/${encodeURIComponent(propertyId)}`, {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        ...(userId ? { 'x-clerk-user-id': userId } : {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        {
          error: 'backend_error',
          status: res.status,
          message: text || 'Failed to load property.',
        },
        { status: 502, headers: { ...noStoreHeaders } },
      );
    }

    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? null, { status: 200, headers: { ...noStoreHeaders } });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'server_error', message: err?.message || 'Unexpected error.' },
      { status: 500, headers: { ...noStoreHeaders } },
    );
  }
}
