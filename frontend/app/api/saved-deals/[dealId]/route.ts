import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

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

export async function DELETE(_req: Request, ctx: any) {
  try {
    const dealId = String(ctx?.params?.dealId ?? '');
    if (!dealId) {
      return NextResponse.json({ ok: false, error: 'Missing dealId' }, { status: 400 });
    }

    const { userId, token } = await getBearerTokenOrNull();
    if (isClerkServerEnabled() && !userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetch(`${getBackendBase()}/saved-deals/${encodeURIComponent(dealId)}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
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
      { ok: false, error: err?.message || 'Delete saved deal proxy error' },
      { status: 502 },
    );
  }
}
