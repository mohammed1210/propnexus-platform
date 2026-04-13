import { NextResponse } from 'next/server';

export async function GET(_request: Request, ctx: any) {
  const params = await ctx?.params;
  const pc = String(params?.pc ?? '').trim();
  const base =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    '';

  if (!pc) {
    return NextResponse.json({ error: 'postcode required' }, { status: 400 });
  }

  if (!base) {
    return NextResponse.json(
      { error: 'Missing backend base URL env (NEXT_PUBLIC_BACKEND_URL / BACKEND_URL / NEXT_PUBLIC_API_BASE).' },
      { status: 500 },
    );
  }

  const url = `${base}/comps/${encodeURIComponent(pc)}`;

  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Proxy error' }, { status: 502 });
  }
}
