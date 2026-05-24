// app/api/stripe/checkout/route.ts
import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
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

async function getVerifiedUserContext(): Promise<{ userId: string | null; email: string | null }> {
  if (!isClerkServerEnabled()) return { userId: null, email: null };
  const a: any = await auth();
  const userId = (a?.userId as string | null) ?? null;
  if (!userId) return { userId: null, email: null };
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null;
  return { userId, email: email ? String(email) : null };
}

/**
 * Minimal proxy for Stripe checkout creation.
 * Tries known backend checkout endpoints in order and forwards the JSON body.
 * Works in previews (avoids cross-origin) and production.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const clerkEnabled = isClerkServerEnabled();
    const { userId, email } = await getVerifiedUserContext();
    if (isClerkServerEnabled() && !userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (clerkEnabled && !email) {
      return new Response(JSON.stringify({ error: 'Authenticated email is required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    const backend = getBackendBase();
    const billingEmail = email ?? (typeof body?.email === 'string' ? body.email : null);
    const trustedBody = { ...body, ...(billingEmail ? { email: billingEmail } : {}) };

    // Keep checkout ownership explicit. Portal creation stays on /api/stripe/portal.
    const candidates = [
      '/stripe/checkout', // if you implemented this
      '/stripe/create-checkout-session', // common name
    ];

    for (const path of candidates) {
      try {
        const r = await fetch(`${backend}${path}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...internalApiHeaders(),
            ...(userId ? { 'x-propnexus-user-id': userId, 'x-clerk-user-id': userId } : {}),
            ...(billingEmail ? { 'x-propnexus-user-email': billingEmail } : {}),
          },
          body: JSON.stringify(trustedBody),
        });

        if (r.ok) {
          // Return JSON (e.g., { url })
          const data = await r.json().catch(() => ({}));
          return new Response(JSON.stringify(data), {
            status: r.status,
            headers: { 'content-type': 'application/json' },
          });
        }

        // If not 404, bubble the error back (useful for Stripe messages)
        if (r.status !== 404) {
          const text = await r.text();
          return new Response(text, { status: r.status });
        }
        // else: try next candidate
      } catch {
        // try next candidate
      }
    }

    return new Response(JSON.stringify({ error: 'No Stripe endpoint found on backend' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Unexpected error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
