import { NextResponse } from 'next/server';
import { buildAuthDebugPayload } from '@/lib/authDebug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isDebugEnabled() {
  if (process.env.NODE_ENV !== 'production') return true;
  return ['1', 'true', 'yes', 'on'].includes((process.env.ENABLE_DEBUG_ENDPOINTS ?? '').trim().toLowerCase());
}

export async function GET() {
  if (!isDebugEnabled()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const payload = await buildAuthDebugPayload();
  return NextResponse.json(payload);
}
