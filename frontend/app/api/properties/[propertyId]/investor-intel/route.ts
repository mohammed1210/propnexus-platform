import { NextResponse } from 'next/server';
import { backendFetch, getOptionalClerkUserId } from '@/lib/server/propertyData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await ctx.params;
  try {
    const userId = await getOptionalClerkUserId();
    const res = await backendFetch(`/properties/${encodeURIComponent(propertyId)}/investor-intel`, {
      headers: { ...(userId ? { 'x-clerk-user-id': userId } : {}) },
    });
    const json = await res.json().catch(() => null);
    return NextResponse.json(json, { status: res.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    return NextResponse.json({ error: 'server_error', message: err?.message || 'Unexpected error.' }, { status: 500 });
  }
}
