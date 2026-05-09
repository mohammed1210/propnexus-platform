import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

function getBackendBase(): string {
  const base = (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    ''
  ).trim();

  if (base) return base.replace(/\/+$/, '');
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:8000';
  throw new Error('Missing backend base URL env (NEXT_PUBLIC_BACKEND_URL / NEXT_PUBLIC_API_URL / BACKEND_URL).');
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

  const a: any = await auth();
  const userId = (a?.userId as string | null) ?? null;
  if (!userId) return { userId: null, token: null };

  try {
    const token = typeof a?.getToken === 'function' ? await a.getToken() : null;
    return { userId, token: token ? String(token) : null };
  } catch {
    return { userId, token: null };
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Body must be a JSON object' }, { status: 400 });
    }

    const { userId, token } = await getBearerTokenOrNull();
    if (isClerkServerEnabled() && !userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetch(`${getBackendBase()}/saved-deals/status`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...(userId ? { 'x-clerk-user-id': userId } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const text = await res.text();
    try {
      const json = text ? JSON.parse(text) : null;
      return NextResponse.json(json, { status: res.status });
    } catch {
      return new NextResponse(text, {
        status: res.status,
        headers: { 'content-type': res.headers.get('content-type') || 'text/plain' },
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Saved deal status proxy error' },
      { status: 502 },
    );
  }
}
