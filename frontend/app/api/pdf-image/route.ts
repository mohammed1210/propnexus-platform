import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'X-Robots-Tag': 'noindex',
} as const;

const isPrivateHost = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase();
  if (
    normalized === 'localhost' ||
    normalized === '0.0.0.0' ||
    normalized === '::1' ||
    normalized.endsWith('.local')
  ) {
    return true;
  }

  if (/^127\./.test(normalized) || /^10\./.test(normalized) || /^192\.168\./.test(normalized)) {
    return true;
  }

  const private172 = normalized.match(/^172\.(\d{1,3})\./);
  if (private172) {
    const secondOctet = Number(private172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }

  return /^fc|^fd|^fe80/i.test(normalized);
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url')?.trim();

  if (!target) {
    return NextResponse.json({ error: 'missing_url' }, { status: 400, headers: noStoreHeaders });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400, headers: noStoreHeaders });
  }

  if (!HTTP_PROTOCOLS.has(parsed.protocol) || parsed.username || parsed.password || isPrivateHost(parsed.hostname)) {
    return NextResponse.json({ error: 'unsupported_url' }, { status: 400, headers: noStoreHeaders });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'upstream_error', status: upstream.status },
        { status: 502, headers: noStoreHeaders },
      );
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return NextResponse.json({ error: 'invalid_content_type' }, { status: 415, headers: noStoreHeaders });
    }

    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        ...noStoreHeaders,
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'image_proxy_failed' },
      { status: 502, headers: noStoreHeaders },
    );
  }
}
