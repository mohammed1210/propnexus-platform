import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    {
      detail:
        'This endpoint is disabled. Use /api/stripe/portal with authenticated user context.',
    },
    { status: 410 },
  );
}
