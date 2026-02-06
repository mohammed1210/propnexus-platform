import { NextResponse } from 'next/server';

// Keep this route dependency-light and server-safe.
// It aggregates backend endpoints so the listings card only does ONE request per postcode.
export async function GET(request: Request, ctx: any) {
  const pc = String(ctx?.params?.pc ?? '').trim();
  if (!pc) return NextResponse.json({ error: 'postcode required' }, { status: 400 });

  const url = new URL(request.url);
  const wantArea = url.searchParams.get('area') === '1';
  const wantComps = url.searchParams.get('comps') === '1';

  // If neither requested, avoid work.
  if (!wantArea && !wantComps) {
    return NextResponse.json({ postcode: pc, fetched_at: new Date().toISOString() });
  }

  const base =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'https://propnexus-backend-production.up.railway.app';

  try {
    const [areaRes, compsRes] = await Promise.all([
      wantArea
        ? fetch(`${base.replace(/\/+$/, '')}/area-intel/${encodeURIComponent(pc)}`, {
            method: 'GET',
            cache: 'no-store',
          })
        : Promise.resolve(null),
      wantComps
        ? fetch(`${base.replace(/\/+$/, '')}/comps/${encodeURIComponent(pc)}`, {
            method: 'GET',
            cache: 'no-store',
          })
        : Promise.resolve(null),
    ]);

    // We return partial data where possible; each sub-payload has its own status.
    const out: any = {
      postcode: pc,
      fetched_at: new Date().toISOString(),
    };

    if (wantArea) {
      if (!areaRes) out.area = { error: 'missing response' };
      else if (!areaRes.ok) out.area = { error: `HTTP ${areaRes.status}` };
      else out.area = await areaRes.json();
    }

    if (wantComps) {
      if (!compsRes) out.comps = { error: 'missing response' };
      else if (!compsRes.ok) out.comps = { error: `HTTP ${compsRes.status}` };
      else out.comps = await compsRes.json();
    }

    return NextResponse.json(out, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Proxy error' }, { status: 502 });
  }
}
