import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const disabledPayload = {
  ok: false,
  detail:
    'Stripe webhook ownership lives on the backend /stripe/webhook route. This frontend route is disabled.',
};

function disabledResponse() {
  return NextResponse.json(disabledPayload, { status: 410 });
}

export async function GET() {
  return disabledResponse();
}

export async function POST() {
  return disabledResponse();
}
