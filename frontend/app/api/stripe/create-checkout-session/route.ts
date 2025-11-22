import { NextResponse } from 'next/server';

// Resolve backend URL using standard env var priority (consistent with lib/api.ts)
const BACKEND_BASE =
  (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '') || 'http://localhost:8000';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const r = await fetch(`${BACKEND_BASE}/stripe/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      let detail = '';
      try {
        detail = (await r.json())?.detail ?? '';
      } catch {}
      return NextResponse.json(
        { detail: detail || `Upstream error (${r.status})` },
        { status: r.status },
      );
    }
    return NextResponse.json(await r.json());
  } catch (e: any) {
    return NextResponse.json({ detail: e?.message || 'Proxy error' }, { status: 500 });
  }
}
