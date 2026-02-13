import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
} as const;

function getBackendBase(): string {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'https://propnexus-backend-production.up.railway.app'
  ).replace(/\/+$/, '');
}

function isClerkServerEnabled(): boolean {
  const pk = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '').trim();
  const sk = (process.env.CLERK_SECRET_KEY ?? '').trim();
  const disable = ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_DISABLE_AUTH ?? '').trim().toLowerCase(),
  );
  return !disable && pk.startsWith('pk_') && Boolean(sk);
}

async function getBearerTokenOrNull(): Promise<{ userId: string | null; token: string | null }> {
  if (!isClerkServerEnabled()) return { userId: null, token: null };

  const a = await auth();
  const userId = (a?.userId as string | null) ?? null;
  if (!userId) return { userId: null, token: null };

  try {
    const token = typeof a?.getToken === 'function' ? await a.getToken() : null;
    return { userId, token: token ? String(token) : null };
  } catch {
    return { userId, token: null };
  }
}

export async function GET(req: Request) {
  try {
    const { userId, token } = await getBearerTokenOrNull();
    if (isClerkServerEnabled() && !userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401, headers: { ...noStoreHeaders } },
      );
    }

    const url = new URL(req.url);
    const propertyId = (url.searchParams.get('property_id') ?? '').trim();

    const res = await fetch(`${getBackendBase()}/saved-deals`, {
      method: 'GET',
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });

    const text = await res.text();
    try {
      const json = text ? JSON.parse(text) : null;

      if (propertyId && json && typeof json === 'object') {
        const items = Array.isArray((json as any)?.data) ? (json as any).data : [];
        const filtered = items.filter((d: any) => String(d?.property_id ?? '') === propertyId);
        return NextResponse.json(
          { ...json, data: filtered },
          { status: res.status, headers: { ...noStoreHeaders } },
        );
      }

      return NextResponse.json(json, { status: res.status, headers: { ...noStoreHeaders } });
    } catch {
      return new NextResponse(text, {
        status: res.status,
        headers: {
          ...noStoreHeaders,
          'content-type': res.headers.get('content-type') || 'text/plain',
        },
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal error' },
      { status: 500, headers: { ...noStoreHeaders } },
    );
  }
}
