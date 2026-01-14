import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const location = (body?.location || '').toString().trim();

    if (!location) {
      return NextResponse.json({ error: 'Missing location' }, { status: 400 });
    }

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_BASE ||
      process.env.BACKEND_URL ||
      'http://localhost:8080';

    // Server-side secret (do NOT make this NEXT_PUBLIC)
    const adminToken =
      process.env.OFF_MARKET_ADMIN_TOKEN ||
      process.env.IMPORT_ADMIN_TOKEN ||
      process.env.ADMIN_TOKEN ||
      '';

    const url = `${backendUrl.replace(/\/$/, '')}/import/all?req=${encodeURIComponent(location)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { 'x-admin-token': adminToken } : {}),
      },
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.detail || data?.error || `Import failed (${res.status})` },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
