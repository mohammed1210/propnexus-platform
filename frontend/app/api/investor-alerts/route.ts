import { NextResponse } from 'next/server';
import { backendFetch, getOptionalClerkUserId } from '@/lib/server/propertyData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function proxy(path: string, init: RequestInit = {}) {
  const userId = await getOptionalClerkUserId();
  const res = await backendFetch(path, {
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

export async function GET() {
  return proxy('/investor-alerts');
}

export async function POST(req: Request) {
  return proxy('/investor-alerts', { method: 'POST', body: await req.text() });
}
