import { NextResponse } from 'next/server';

const BE = process.env.NEXT_PUBLIC_BACKEND_URL!;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const r = await fetch(`${BE}/stripe/create-checkout-session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}
