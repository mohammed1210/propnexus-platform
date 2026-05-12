import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEY = process.env.STRIPE_SECRET_KEY;
const BASE = process.env.NEXT_PUBLIC_APP_BASE_URL ?? '';

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

async function getSignedInUserEmail(): Promise<string | null> {
  if (!isClerkServerEnabled()) return null;

  const a: any = await auth();
  const userId = (a?.userId as string | null) ?? null;
  if (!userId) return null;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null;
}

async function fetchJsonOrNull(res: Response): Promise<any> {
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (!type.includes('application/json')) return null;
  return res.json().catch(() => null);
}

async function getCustomerIdForSignedInUser(email: string): Promise<string | null> {
  const res = await fetch(`${getBackendBase()}/users/plan?email=${encodeURIComponent(email)}`, {
    method: 'GET',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    const payload = await fetchJsonOrNull(res);
    const message = payload?.detail || payload?.message || payload?.error || 'Failed to load billing profile';
    throw new Error(String(message));
  }

  const payload = await fetchJsonOrNull(res);
  const customer = payload?.stripe_customer_id;
  return typeof customer === 'string' && customer.trim() ? customer.trim() : null;
}

export async function POST() {
  try {
    if (!isClerkServerEnabled()) {
      return NextResponse.json(
        { ok: false, error: 'You must be signed in to manage billing.' },
        { status: 401 },
      );
    }

    const email = await getSignedInUserEmail();
    if (!email) {
      return NextResponse.json(
        { ok: false, error: 'You must be signed in to manage billing.' },
        { status: 401 },
      );
    }

    if (!KEY) {
      return NextResponse.json(
        { ok: false, error: 'Billing portal is not configured right now.' },
        { status: 500 },
      );
    }

    const stripe = new Stripe(KEY, { apiVersion: '2026-03-25.dahlia' });

    const customer = await getCustomerIdForSignedInUser(email);

    if (!customer) {
      return NextResponse.json(
        { ok: false, error: 'No billing account found for your signed-in user.' },
        { status: 404 },
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${BASE || 'http://localhost:3000'}/account`,
    });

    return NextResponse.json({ ok: true, url: session.url });
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
