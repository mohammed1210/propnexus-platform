import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SavedDealRow = {
  id: string;
  property_id?: string | null;
  created_at?: string | null;
  saved_at?: string | null;
  clerk_user_id?: string | null;
  data?: unknown;
};

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
} as const;

function getBackendBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    ''
  ).replace(/\/+$/, '');
}

async function backendFetch(path: string, init?: RequestInit) {
  const base = getBackendBaseUrl();
  if (!base) {
    throw new Error('Missing BACKEND base URL env (NEXT_PUBLIC_BACKEND_URL / BACKEND_URL / NEXT_PUBLIC_API_BASE).');
  }
  const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  return fetch(url, { ...init, cache: 'no-store' });
}

function getPropertyId(row: SavedDealRow): string | null {
  const direct = (row.property_id ?? '').toString().trim();
  if (direct) return direct;
  const data = row.data as any;
  const nested = (data?.property_id ?? '').toString().trim();
  return nested || null;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'You must be signed in to view saved deals.' },
      { status: 401, headers: { ...noStoreHeaders } },
    );
  }

  try {
    const dealsRes = await backendFetch('/saved-deals', {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        'x-clerk-user-id': userId,
      },
    });

    if (!dealsRes.ok) {
      const text = await dealsRes.text().catch(() => '');
      return NextResponse.json(
        {
          error: 'backend_error',
          status: dealsRes.status,
          message: text || 'Failed to load saved deals.',
        },
        { status: 502, headers: { ...noStoreHeaders } },
      );
    }

    const raw = (await dealsRes.json().catch(() => null)) as
      | SavedDealRow[]
      | { deals?: SavedDealRow[]; data?: SavedDealRow[] }
      | null;

    const dealsList: SavedDealRow[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as any)?.deals)
        ? ((raw as any).deals as SavedDealRow[])
        : Array.isArray((raw as any)?.data)
          ? ((raw as any).data as SavedDealRow[])
          : [];

    const settled = await Promise.allSettled(
      dealsList.map(async (d) => {
        const propertyId = getPropertyId(d);
        if (!propertyId) {
          return {
            id: String(d.id),
            property_id: '',
            saved_at: (d.saved_at ?? d.created_at ?? null) as string | null,
            property: null,
          };
        }

        const propRes = await backendFetch(`/properties/${encodeURIComponent(propertyId)}`, {
          method: 'GET',
          headers: { 'content-type': 'application/json' },
        });

        if (!propRes.ok) {
          return {
            id: String(d.id),
            property_id: propertyId,
            saved_at: (d.saved_at ?? d.created_at ?? null) as string | null,
            property: null,
          };
        }

        const property = await propRes.json().catch(() => null);
        return {
          id: String(d.id),
          property_id: propertyId,
          saved_at: (d.saved_at ?? d.created_at ?? null) as string | null,
          property,
        };
      }),
    );

    const enriched = settled.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      const d = dealsList[i];
      const propertyId = d ? getPropertyId(d) : null;
      return {
        id: d?.id ? String(d.id) : String(i),
        property_id: propertyId ?? '',
        saved_at: (d?.saved_at ?? d?.created_at ?? null) as string | null,
        property: null,
      };
    });

    return NextResponse.json({ deals: enriched }, { status: 200, headers: { ...noStoreHeaders } });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'server_error', message: err?.message || 'Unexpected error.' },
      { status: 500, headers: { ...noStoreHeaders } },
    );
  }
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: { ...noStoreHeaders } });
  }

  const url = new URL(req.url);
  const propertyId = (url.searchParams.get('property_id') ?? '').trim();
  const dealId = (url.searchParams.get('deal_id') ?? '').trim();

  // Our backend delete endpoint is keyed by property_id.
  const identifier = propertyId || dealId;
  if (!identifier) {
    return NextResponse.json(
      { error: 'bad_request', message: 'Missing property_id (or deal_id fallback).' },
      { status: 400, headers: { ...noStoreHeaders } },
    );
  }

  try {
    const res = await backendFetch(`/saved-deals/${encodeURIComponent(identifier)}`, {
      method: 'DELETE',
      headers: {
        'content-type': 'application/json',
        'x-clerk-user-id': userId,
      },
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ ok: true, data }, { status: 200, headers: { ...noStoreHeaders } });
    }

    const text = await res.text().catch(() => '');
    return NextResponse.json(
      { ok: false, error: 'backend_error', status: res.status, message: text || 'Remove failed.' },
      { status: 502, headers: { ...noStoreHeaders } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: 'server_error', message: e?.message || 'Unexpected error.' },
      { status: 500, headers: { ...noStoreHeaders } },
    );
  }
}
