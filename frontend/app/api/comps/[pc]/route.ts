import { NextResponse } from 'next/server';
import { fetchWithRetry, BASE as API_BASE } from '@/lib/api';

export async function GET(_: Request, context: { params: { pc: string } }) {
  const pc = context.params.pc;
  const url = `${process.env.NEXT_PUBLIC_BACKEND_URL || API_BASE}/comps/${encodeURIComponent(pc)}`;
  try {
    const res = await fetchWithRetry(url, { method: 'GET' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'proxy error' }, { status: 502 });
  }
}
