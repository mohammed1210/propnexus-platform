import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const a = auth();

  return NextResponse.json(
    {
      hasUserId: Boolean(a.userId),
      userId: a.userId ?? null,
      sessionId: (a as any)?.sessionId ?? null,
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
