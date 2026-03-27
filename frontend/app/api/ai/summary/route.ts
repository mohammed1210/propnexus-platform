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

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    for (const key of ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'true-client-ip']) {
      const value = req.headers.get(key);
      if (value) headers[key] = value;
    }

    const upstream = await fetch(`${resolveBackendBase()}/ai/summary`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const upstreamType = (upstream.headers.get('content-type') || '').toLowerCase();
    const status = upstream.status;

    if (!upstream.ok) {
      if (upstreamType.includes('application/json')) {
        const errorJson = await upstream.json().catch(() => null as any);
        const detail =
          errorJson?.detail ||
          errorJson?.message ||
          errorJson?.error ||
          'Failed to generate summary';
        return NextResponse.json({ detail: String(detail) }, { status });
      }

      return NextResponse.json({ detail: 'Failed to generate summary' }, { status });
    }

    if (!upstreamType.includes('application/json')) {
      return NextResponse.json({ detail: 'Invalid summary response format' }, { status: 502 });
    }

    const data = await upstream.json();
    return NextResponse.json(data, { status });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Summary proxy error' },
      { status: 500 },
    );
  }
}
