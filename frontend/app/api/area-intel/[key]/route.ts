import { NextResponse } from 'next/server';
import { fetchWithRetry, BASE as API_BASE } from '@/lib/api';

export async function GET(_: Request, context: { params: { key: string } }) {
  const k = context.params.key;
  const url = `${process.env.NEXT_PUBLIC_BACKEND_URL || API_BASE}/area-intel/${encodeURIComponent(k)}`;
  try {
    const res = await fetchWithRetry(url, { method: 'GET' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'proxy error' }, { status: 502 });
  }
}
