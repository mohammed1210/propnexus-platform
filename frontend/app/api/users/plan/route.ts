import { NextRequest, NextResponse } from 'next/server';

function resolveBackendBase(): string {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    'http://localhost:8000'
  ).replace(/\/+$/, '');
}

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email');
    const upstreamUrl = new URL(`${resolveBackendBase()}/users/plan`);
    if (email) upstreamUrl.searchParams.set('email', email);

    const authHeader = req.headers.get('authorization');
    const upstream = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      cache: 'no-store',
    });

    const upstreamType = (upstream.headers.get('content-type') || '').toLowerCase();

    if (!upstream.ok) {
      if (upstreamType.includes('application/json')) {
        const errorJson = await upstream.json().catch(() => null as any);
        const detail = errorJson?.detail || errorJson?.message || errorJson?.error || 'Plan lookup failed';
        return NextResponse.json({ detail: String(detail) }, { status: upstream.status });
      }
      return NextResponse.json({ detail: 'Plan lookup failed' }, { status: upstream.status });
    }

    if (!upstreamType.includes('application/json')) {
      return NextResponse.json({ detail: 'Invalid plan response format' }, { status: 502 });
    }

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Plan proxy error' },
      { status: 500 },
    );
  }
}
