import { NextResponse } from 'next/server';

/**
 * Proxies POST /api/stripe/create-portal-session -> BACKEND /stripe/create-portal-session
 * Keeps Preview/Production working without cross-origin CORS issues.
 */

// Resolve backend URL using standard env var priority (consistent with lib/api.ts)
const BACKEND_BASE =
  (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '') || 'http://localhost:8000';

export const runtime = 'nodejs'; // or 'edge' if your backend allows it

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = body?.email as string | undefined;
    if (!email) {
      return NextResponse.json({ detail: 'Missing email' }, { status: 400 });
    }

    const res = await fetch(`${BACKEND_BASE}/stripe/create-portal-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      // Forward cookies/headers only if your backend needs them (Stripe route usually doesn't)
      // credentials: 'include',
    });

    // Pass through JSON (or a normalized error)
    if (!res.ok) {
      let detail = '';
      try {
        detail = (await res.json())?.detail ?? '';
      } catch {
        /* ignore */
      }
      return NextResponse.json(
        { detail: detail || `Upstream error (${res.status})` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ detail: e?.message || 'Proxy error' }, { status: 500 });
  }
}
