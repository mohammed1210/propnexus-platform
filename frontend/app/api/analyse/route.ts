import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { analyseDealSchema } from '@/lib/analyseDealSchema';
import { internalApiHeaders, isInternalApiConfigError } from '@/lib/server/internalApi';

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

async function getVerifiedUserId(): Promise<string | null> {
  if (!isClerkServerEnabled()) return null;

  const session: any = await auth();
  return (session?.userId as string | null) ?? null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = analyseDealSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'validation_error',
          message: parsed.error.issues[0]?.message ?? 'Invalid input.',
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const userId = await getVerifiedUserId();
    if (isClerkServerEnabled() && !userId) {
      return NextResponse.json(
        { ok: false, error: 'unauthorized', message: 'You must be signed in to create a deal.' },
        { status: 401 },
      );
    }

    const payload = parsed.data;
    const upstream = await fetch(`${getBackendBase()}/properties/user-submitted`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...internalApiHeaders(),
        ...(userId ? { 'x-propnexus-user-id': userId, 'x-clerk-user-id': userId } : {}),
      },
      body: JSON.stringify({
        source_url: payload.sourceUrl,
        title: payload.title,
        location: payload.location,
        postcode: payload.postcode,
        price: payload.price,
        bedrooms: payload.bedrooms,
        bathrooms: payload.bathrooms,
        property_type: payload.propertyType,
        estimated_monthly_rent: payload.estimatedMonthlyRent,
        description: payload.description,
      }),
      cache: 'no-store',
    });

    const text = await upstream.text();
    try {
      const json = text ? JSON.parse(text) : null;
      return NextResponse.json(json, { status: upstream.status });
    } catch {
      return new NextResponse(text, {
        status: upstream.status,
        headers: { 'content-type': upstream.headers.get('content-type') || 'text/plain' },
      });
    }
  } catch (err: any) {
    if (isInternalApiConfigError(err)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'server_configuration',
          message: 'Deal creation is temporarily unavailable. Please try again shortly.',
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Could not create this deal.' },
      { status: 502 },
    );
  }
}
