import { NextResponse } from 'next/server';
import { fetchWithRetry, BASE as API_BASE } from '@/lib/api';

export async function GET(request: Request, ctx: any) {
  const pc = String(ctx?.params?.pc ?? '');
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || API_BASE;
  const url = `${base}/comps/${encodeURIComponent(pc)}`;

  try {
    const res = await fetchWithRetry(url, { method: 'GET' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Proxy error' },
      { status: 502 }
    );
  }
}
