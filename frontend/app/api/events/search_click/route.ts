import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function resolveBackendBase(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_BACKEND_URL,
    process.env.BACKEND_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_API_BASE,
    process.env.BACKEND_API_URL,
    'http://localhost:8000',
  ]
    .map((v) => (v || '').trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const base = candidates.find((v) => v !== '/api');
  return base || 'http://localhost:8000';
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const upstream = await fetch(`${resolveBackendBase()}/events/search_click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'search_click proxy error' },
      { status: 500 },
    );
  }
}
