import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

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
  throw new Error('Missing backend base URL env.');
}

function isClerkServerEnabled(): boolean {
  const pk = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '').trim();
  const sk = (process.env.CLERK_SECRET_KEY ?? '').trim();
  const disable = ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_DISABLE_AUTH ?? '').trim().toLowerCase(),
  );
  return !disable && pk.startsWith('pk_') && Boolean(sk);
}

async function getSignedInUserEmail(): Promise<string | null> {
  if (!isClerkServerEnabled()) return null;

  const a: any = await auth();
  const userId = (a?.userId as string | null) ?? null;
  if (!userId) return null;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null;
}

export async function GET() {
  try {
    if (!isClerkServerEnabled()) {
      return NextResponse.json({ detail: 'Authentication is required.' }, { status: 401 });
    }

    const email = await getSignedInUserEmail();
    if (!email) {
      return NextResponse.json({ detail: 'Authentication is required.' }, { status: 401 });
    }

    const res = await fetch(`${getBackendBase()}/users/plan?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { detail: data?.detail || 'Failed to load plan' },
        { status: res.status },
      );
    }

    return NextResponse.json({
      plan: data?.plan || 'free',
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || 'Failed to load plan' },
      { status: 500 },
    );
  }
}
