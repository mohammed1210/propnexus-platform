import { NextResponse } from 'next/server';
import { fetchPropertyById, getOptionalClerkUserId } from '@/lib/server/propertyData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
} as const;

export async function GET(_req: Request, ctx: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await ctx.params;

  try {
    const userId = await getOptionalClerkUserId();
    const data = await fetchPropertyById(propertyId, userId);
    return NextResponse.json(data ?? null, { status: 200, headers: { ...noStoreHeaders } });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'server_error', message: err?.message || 'Unexpected error.' },
      { status: 500, headers: { ...noStoreHeaders } },
    );
  }
}
