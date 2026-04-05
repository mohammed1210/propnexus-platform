import { NextResponse } from 'next/server';

// NOTE: Next 15 validator can reject inline context typing.
// Use `any` and narrow inside to keep validation happy.
export async function GET(_request: Request, ctx: any) {
  const params = await ctx?.params;
  const key = String(params?.key ?? '').trim();
  const base =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    '';

  if (!key) {
    return NextResponse.json({ error: 'key required' }, { status: 400 });
  }

  if (!base) {
    return NextResponse.json(
      { error: 'Missing backend base URL env (NEXT_PUBLIC_BACKEND_URL / BACKEND_URL / NEXT_PUBLIC_API_BASE).' },
      { status: 500 },
    );
  }

  const url = `${base}/area-intel/${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Proxy error' }, { status: 502 });
  }
}
