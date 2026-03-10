import type { NextApiRequest, NextApiResponse } from 'next';

function stripTrailingSlash(v: string): string {
  return v.replace(/\/+$/, '');
}

function getCurrentOrigin(req: NextApiRequest): string {
  const host = req.headers.host || '';
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader)
    ? protoHeader[0]
    : protoHeader || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  return stripTrailingSlash(`${proto}://${host}`);
}

function resolveBackendBase(req: NextApiRequest): string {
  const candidates = [
    process.env.NEXT_PUBLIC_BACKEND_URL,
    process.env.BACKEND_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_API_BASE,
  ]
    .map((v) => (v || '').trim())
    .filter(Boolean)
    .map(stripTrailingSlash);

  const currentOrigin = getCurrentOrigin(req);

  const backend = candidates.find(
    (c) => c !== currentOrigin && c !== `${currentOrigin}/api` && c !== '/api',
  );

  return backend || '';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const backendBase = resolveBackendBase(req);
  if (!backendBase) {
    return res.status(503).json({
      error: 'backend_unconfigured',
      message:
        'Backend URL is not configured. Set NEXT_PUBLIC_BACKEND_URL or BACKEND_URL in deployment env vars.',
    });
  }

  try {
    const qs = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const url = `${backendBase}/properties${qs}`;

    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...(typeof req.headers.authorization === 'string'
          ? { authorization: req.headers.authorization }
          : {}),
        ...(typeof req.headers['x-clerk-user-id'] === 'string'
          ? { 'x-clerk-user-id': req.headers['x-clerk-user-id'] }
          : {}),
      },
      cache: 'no-store',
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(upstream.status);

    if (contentType.includes('application/json')) {
      try {
        return res.json(text ? JSON.parse(text) : null);
      } catch {
        return res.json({ error: 'invalid_upstream_json', body: text.slice(0, 500) });
      }
    }

    return res.send(text);
  } catch (error: any) {
    return res.status(502).json({
      error: 'backend_fetch_failed',
      message: error?.message || 'Failed to fetch properties from backend.',
    });
  }
}
