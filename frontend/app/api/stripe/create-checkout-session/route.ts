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

async function getVerifiedUserContext(): Promise<{ userId: string | null; token: string | null }> {
  if (!isClerkServerEnabled()) return { userId: null, token: null };
  const a: any = await auth();
  const userId = (a?.userId as string | null) ?? null;
  if (!userId) return { userId: null, token: null };
  const token = typeof a?.getToken === 'function' ? await a.getToken().catch(() => null) : null;
  return { userId, token: token ? String(token) : null };
}

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId, token } = await getVerifiedUserContext();
    if (isClerkServerEnabled() && !userId) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    const r = await fetch(`${getBackendBase()}/stripe/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'x-clerk-user-id': userId } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      let detail = '';
      try {
        detail = (await r.json())?.detail ?? '';
      } catch {}
      return NextResponse.json(
        { detail: detail || `Upstream error (${r.status})` },
        { status: r.status },
      );
    }
    return NextResponse.json(await r.json());
  } catch (e: any) {
    return NextResponse.json({ detail: e?.message || 'Proxy error' }, { status: 500 });
  }
}
