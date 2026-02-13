import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cookies, headers } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
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
      userId: a.userId ?? null,
      sessionId: (a as any)?.sessionId ?? null,
      request: {
        host: h.get('host'),
        forwardedHost: h.get('x-forwarded-host'),
        forwardedProto: h.get('x-forwarded-proto'),
      },
      cookies: {
        count: cookieNames.length,
        names: cookieNames,
        hasClerkCookie,
      },
      clerkHeaders: {
        names: clerkHeaderNames,
        authStatus,
        authReason,
        authMessage,
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
