import { NextResponse } from 'next/server';
import { getAllowedPdfImageHost } from '@/lib/pdfImageProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'X-Robots-Tag': 'noindex',
} as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = searchParams.get('host')?.trim().toLowerCase();
  const protocol = searchParams.get('protocol')?.trim();
  const path = searchParams.get('path')?.trim();

  if (!host || !protocol || !path) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400, headers: noStoreHeaders });
  }

  const safeHost = getAllowedPdfImageHost(host);
  if (!safeHost) {
    return NextResponse.json({ error: 'unsupported_host' }, { status: 400, headers: noStoreHeaders });
  }

  if ((protocol !== 'http:' && protocol !== 'https:') || !path.startsWith('/') || path.startsWith('//')) {
    return NextResponse.json({ error: 'invalid_target' }, { status: 400, headers: noStoreHeaders });
  }

  try {
    const upstreamUrl = new URL(path, `${protocol}//${safeHost}`);
    const upstream = await fetch(upstreamUrl.toString(), {
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
    // Whitelist specific allowed image MIME types for stronger security
    const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
    const mimeType = contentType.toLowerCase().split(';')[0]; // Remove charset or other parameters
    if (!allowedImageTypes.has(mimeType)) {
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
