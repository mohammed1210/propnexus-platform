import { NextResponse } from 'next/server';
import { backendFetch, getOptionalClerkUserId } from '@/lib/server/propertyData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'no-store' } as const;

async function readBackendBody(res: Response) {
  const clone = res.clone();
  const json = await res.json().catch(() => null);
  if (json) return json;
  const text = await clone.text().catch(() => '');
  return text ? { error: 'backend_error', message: text } : null;
}

async function proxy(alertId: string, init: RequestInit) {
  const userId = await getOptionalClerkUserId();
  if (!userId) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Please sign in to manage deal alerts.' },
      { status: 401, headers: noStoreHeaders },
    );
  }

  try {
    const res = await backendFetch(`/investor-alerts/${encodeURIComponent(alertId)}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-clerk-user-id': userId,
        ...(init.headers || {}),
      },
    });
    const body = await readBackendBody(res);
    return NextResponse.json(body, { status: res.status, headers: noStoreHeaders });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'backend_unavailable',
        message: err?.message || 'Deal alerts are temporarily unavailable.',
      },
      { status: 502, headers: noStoreHeaders },
    );
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ alertId: string }> }) {
  const { alertId } = await ctx.params;
  return proxy(alertId, { method: 'PATCH', body: await req.text() });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ alertId: string }> }) {
  const { alertId } = await ctx.params;
  return proxy(alertId, { method: 'DELETE' });
}
