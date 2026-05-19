import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { internalApiHeaders } from '@/lib/server/internalApi';

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

async function getVerifiedUserId(): Promise<string | null> {
  if (!isClerkServerEnabled()) return null;

  const a = await auth();
  const userId = (a?.userId as string | null) ?? null;
  return userId;
}

export async function DELETE(_req: Request, ctx: any) {
  try {
    const dealId = String(ctx?.params?.dealId ?? '');
    if (!dealId) {
      return NextResponse.json({ ok: false, error: 'Missing dealId' }, { status: 400 });
    }

    const userId = await getVerifiedUserId();
    if (isClerkServerEnabled() && !userId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const res = await fetch(`${getBackendBase()}/saved-deals/${encodeURIComponent(dealId)}`, {
      method: 'DELETE',
      headers: {
        ...internalApiHeaders(),
        ...(userId ? { 'x-propnexus-user-id': userId, 'x-clerk-user-id': userId } : {}),
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
      { ok: false, error: err?.message || 'Internal error' },
      { status: 500 },
    );
  }
}
