import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getBackendBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    ''
  ).replace(/\/+$/, '');
}

export async function GET(request: Request) {
  const backend = getBackendBaseUrl();
  if (!backend) {
    return NextResponse.json(
      { error: 'Missing backend base URL env (NEXT_PUBLIC_BACKEND_URL / BACKEND_URL / NEXT_PUBLIC_API_BASE).' },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const lat = (url.searchParams.get('lat') ?? '').trim();
  const lng = (url.searchParams.get('lng') ?? '').trim();
  const radiusKm = (url.searchParams.get('radius_km') ?? '').trim();
  const tradeType = (url.searchParams.get('trade_type') ?? '').trim();

  const upstreamParams = new URLSearchParams();
  if (lat) upstreamParams.set('lat', lat);
  if (lng) upstreamParams.set('lng', lng);
  if (radiusKm) upstreamParams.set('radius_km', radiusKm);
  if (tradeType) upstreamParams.set('trade_type', tradeType);

  try {
    const res = await fetch(`${backend}/tradesmen/nearby?${upstreamParams.toString()}`, {
      method: 'GET',
      cache: 'no-store',
    });

    const text = await res.text();
    const contentType = res.headers.get('content-type') || 'application/json';

    return new NextResponse(text, {
      status: res.status,
      headers: {
        'content-type': contentType,
        'cache-control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Proxy error' }, { status: 502 });
  }
}
