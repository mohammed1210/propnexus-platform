import { NextResponse } from 'next/server';
import { fetchWithRetry, BASE as API_BASE } from '@/lib/api';

// NOTE: Next 15 validator can reject inline context typing.
// Use `any` and narrow inside to keep validation happy.
export async function GET(request: Request, ctx: any) {
  const key = String(ctx?.params?.key ?? '');
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || API_BASE;
  const url = `${base}/area-intel/${encodeURIComponent(key)}`;

  try {
    const res = await fetchWithRetry(url, { method: 'GET' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Proxy error' }, { status: 502 });
  }
}
