// src/app/api/comps/[postcode]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // don't cache during dev

type Params = { postcode: string };

export async function GET(
  _req: NextRequest,
  { params }: { params: Params }
) {
  const { postcode } = params;

  if (!postcode) {
    return NextResponse.json({ error: 'Missing postcode' }, { status: 400 });
  }

  // Prefer public API URL; fall back to backend URL; otherwise return demo data
  const BASE =
    (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '').trim();

  try {
    if (BASE && BASE.startsWith('http')) {
      const url = `${BASE}/comps/${encodeURIComponent(postcode)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Upstream error ${res.status}` },
          { status: 502 }
        );
      }
      const data = await res.json();
      return NextResponse.json(data, { status: 200 });
    }

    // Fallback demo payload (keeps the UI working if backend not set)
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