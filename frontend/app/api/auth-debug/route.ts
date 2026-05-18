import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cookies, headers } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isDebugEnabled() {
  if (process.env.NODE_ENV !== 'production') return true;
  return ['1', 'true', 'yes', 'on'].includes((process.env.ENABLE_DEBUG_ENDPOINTS ?? '').trim().toLowerCase());
}

export async function GET() {
  if (!isDebugEnabled()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const a = await auth();
  const h = await headers();
  const c = await cookies();

  const cookieNames = c.getAll().map((x) => x.name);
  const hasClerkCookie = cookieNames.some((n) =>
    [
      '__session',
      '__client_uat',
      '__clerk_db_jwt',
      '__clerk_handshake',
      '__clerk_client_jwt',
    ].includes(n),
  );

  const clerkHeaderNames = Array.from(h.keys()).filter((k) => {
    const key = k.toLowerCase();
    return key.startsWith('x-clerk-') || key.startsWith('clerk');
  });

  const getHeader = (name: string) => h.get(name) ?? h.get(name.toLowerCase());
  const authStatus =
    getHeader('x-clerk-auth-status') ??
    getHeader('AuthStatus') ??
    null;
  const authReason =
    getHeader('x-clerk-auth-reason') ??
    getHeader('AuthReason') ??
    null;
  const authMessage =
    getHeader('x-clerk-auth-message') ??
    getHeader('AuthMessage') ??
    null;

  return NextResponse.json(
    {
      hasUserId: Boolean(a.userId),
      request: {
        hasHost: Boolean(h.get('host')),
        hasForwardedHost: Boolean(h.get('x-forwarded-host')),
        hasForwardedProto: Boolean(h.get('x-forwarded-proto')),
      },
      cookies: {
        count: cookieNames.length,
        hasClerkCookie,
      },
      clerkHeaders: {
        count: clerkHeaderNames.length,
        authStatus,
        hasAuthReason: Boolean(authReason),
        hasAuthMessage: Boolean(authMessage),
      },
      env: {
        hasClerkSecretKey: Boolean(process.env.CLERK_SECRET_KEY),
        hasClerkPublishableKey: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
