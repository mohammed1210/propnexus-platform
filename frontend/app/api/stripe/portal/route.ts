import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { internalApiHeaders } from '@/lib/server/internalApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

async function getSignedInUserContext(): Promise<{ userId: string | null; email: string | null }> {
  if (!isClerkServerEnabled()) return { userId: null, email: null };

  const a: any = await auth();
  const userId = (a?.userId as string | null) ?? null;
  if (!userId) return { userId: null, email: null };

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null;
  return { userId, email: email ? String(email) : null };
}

export async function POST() {
  try {
    if (!isClerkServerEnabled()) {
      return NextResponse.json(
        { ok: false, error: 'You must be signed in to manage billing.' },
        { status: 401 },
      );
    }

    const { userId, email } = await getSignedInUserContext();
    if (!userId || !email) {
      return NextResponse.json(
        { ok: false, error: 'You must be signed in to manage billing.' },
        { status: 401 },
      );
    }

    const upstream = await fetch(`${getBackendBase()}/stripe/create-portal-session`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...internalApiHeaders(),
        'x-propnexus-user-id': userId,
        'x-propnexus-user-email': email,
      },
      body: JSON.stringify({ email }),
      cache: 'no-store',
    });

    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return NextResponse.json(
        { ok: false, error: upstream.status === 404 ? 'No billing account found for your signed-in user.' : 'Could not open billing portal right now.' },
        { status: upstream.status },
      );
    }

    return NextResponse.json({ ok: true, url: payload?.url });
  } catch (err: any) {
    console.error('Stripe portal error', {
      message: err?.message,
      code: err?.code,
      type: err?.type,
    });
    return NextResponse.json(
      { ok: false, error: 'Could not open billing portal right now.' },
      { status: 500 },
    );
  }
}
