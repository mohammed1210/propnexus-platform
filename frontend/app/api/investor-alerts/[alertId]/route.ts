import { NextResponse } from 'next/server';
import { backendFetch, getOptionalClerkUserId } from '@/lib/server/propertyData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function proxy(alertId: string, init: RequestInit) {
  const userId = await getOptionalClerkUserId();
  const res = await backendFetch(`/investor-alerts/${encodeURIComponent(alertId)}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(userId ? { 'x-clerk-user-id': userId } : {}),
      ...(init.headers || {}),
    },
  });
  const json = await res.json().catch(() => null);
  return NextResponse.json(json, { status: res.status, headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ alertId: string }> }) {
  const { alertId } = await ctx.params;
  return proxy(alertId, { method: 'PATCH', body: await req.text() });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ alertId: string }> }) {
  const { alertId } = await ctx.params;
  return proxy(alertId, { method: 'DELETE' });
}
