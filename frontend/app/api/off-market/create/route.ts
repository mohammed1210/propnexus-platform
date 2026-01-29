import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST.' },
    { status: 405, headers: { Allow: 'POST' } },
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.BACKEND_URL ||
      'http://localhost:8080';

    // Server-side secret (do NOT make this NEXT_PUBLIC)
    const adminToken =
      process.env.OFF_MARKET_ADMIN_TOKEN ||
      process.env.IMPORT_ADMIN_TOKEN ||
      process.env.ADMIN_TOKEN ||
      '';

    const url = `${backendUrl.replace(/\/$/, '')}/off-market/create`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.detail || data?.error || `Create failed (${res.status})` },
        { status: res.status },
      );
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
