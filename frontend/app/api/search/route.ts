import { NextRequest, NextResponse } from 'next/server';

function resolveBackendBase(): string {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    'http://localhost:8000'
  );
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const upstream = await fetch(`${resolveBackendBase()}/api/v1/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'search proxy error' },
      { status: 500 },
    );
  }
}
