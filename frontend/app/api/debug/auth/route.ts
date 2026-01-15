import { NextResponse } from 'next/server';
import { buildAuthDebugPayload } from '@/lib/authDebug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const payload = await buildAuthDebugPayload();
  return NextResponse.json(payload);
}
