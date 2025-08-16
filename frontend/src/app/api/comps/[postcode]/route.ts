import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { postcode: string } }
) {
  const postcode = params?.postcode;

  if (!postcode) {
    return NextResponse.json({ error: 'Missing postcode' }, { status: 400 });
  }

  // Prefer public API URL; fall back to backend URL
  const BASE = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '').trim();

  try {
    if (BASE && BASE.startsWith('http')) {
      const url = `${BASE}/comps/${encodeURIComponent(postcode)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        return NextResponse.json({ error: `Upstream error ${res.status}` }, { status: 502 });
      }
      const data = await res.json();
      return NextResponse.json(data, { status: 200 });
    }

    // Fallback payload so builds still succeed without a backend
    return NextResponse.json(
      {
        postcode,
        sales: [],
        rents: [],
        note: 'Demo data — backend URL not configured',
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch comps', detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}