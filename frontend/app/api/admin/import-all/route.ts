import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const location = (body?.location || '').toString().trim();

    if (!location) {
      return NextResponse.json({ error: 'Missing location' }, { status: 422 });
    }

    // Backend URL: use the public env you already have
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_BASE ||
      process.env.BACKEND_URL ||
      'http://localhost:8080';

    // Server-side secret (DO NOT make this NEXT_PUBLIC)
    const adminToken = process.env.IMPORT_ADMIN_TOKEN || '';

    const res = await fetch(`${backendUrl}/import/all?req=${encodeURIComponent(location)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { 'x-admin-token': adminToken } : {}),
      },
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Import failed' }, { status: 500 });
  }
}
