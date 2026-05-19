import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { internalApiHeaders } from '@/lib/server/internalApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SavedDealRow = {
  id: string;
  property_id?: string | null;
  created_at?: string | null;
  saved_at?: string | null;
  clerk_user_id?: string | null;
  deal_status?: string | null;
  contacted_at?: string | null;
  last_action_at?: string | null;
  action_notes?: string | null;
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

async function getSafeUserId(): Promise<string | null> {
  if (
    process.env.SCREENSHOT_TEST === 'true' ||
    ['1', 'true', 'yes', 'on'].includes((process.env.NEXT_PUBLIC_DISABLE_AUTH ?? '').trim().toLowerCase())
  ) {
    return null;
  }

  try {
    const { userId } = await auth();
    return userId ?? null;
  } catch {
    return null;
  }
}

function getPropertyId(row: SavedDealRow): string | null {
  const direct = (row.property_id ?? '').toString().trim();
  if (direct) return direct;
  const data = row.data as any;
  const nested = (data?.property_id ?? '').toString().trim();
  return nested || null;
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function mergeMissing(target: Record<string, any>, source: Record<string, any>, keys: string[]) {
  for (const k of keys) {
    if (target[k] === undefined || target[k] === null || target[k] === '') {
      const sv = source[k];
      if (sv !== undefined && sv !== null && sv !== '') {
        target[k] = sv;
      }
    }
  }
}

export async function GET(req?: Request) {
  const userId = await getSafeUserId();
  if (!userId) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'You must be signed in to view saved deals.' },
      { status: 401, headers: { ...noStoreHeaders } },
    );
  }

  try {
    const url = new URL(req?.url ?? 'http://localhost/api/saved-deals');
    const propertyIdFilter = url.searchParams.get('property_id')?.trim();

    const dealsRes = await backendFetch(`/saved-deals?user_id=${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        ...internalApiHeaders(),
        'x-propnexus-user-id': userId,
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

    let dealsList: SavedDealRow[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as any)?.deals)
        ? ((raw as any).deals as SavedDealRow[])
        : Array.isArray((raw as any)?.data)
          ? ((raw as any).data as SavedDealRow[])
          : [];

    if (propertyIdFilter) {
      dealsList = dealsList.filter((row) => getPropertyId(row) === propertyIdFilter);
      const matchingDeals = dealsList.map((d) => ({
        id: String(d.id),
        property_id: getPropertyId(d) ?? '',
        saved_at: (d.saved_at ?? d.created_at ?? null) as string | null,
        deal_status: d.deal_status ?? null,
        contacted_at: d.contacted_at ?? null,
        last_action_at: d.last_action_at ?? null,
        action_notes: d.action_notes ?? null,
        property: null,
      }));

      return NextResponse.json(
        { deals: matchingDeals, saved: matchingDeals.length > 0 },
        { status: 200, headers: { ...noStoreHeaders } },
      );
    }

    const settled = await Promise.allSettled(
      dealsList.map(async (d) => {
        const propertyId = getPropertyId(d);
        if (!propertyId) {
          return {
            id: String(d.id),
            property_id: '',
            saved_at: (d.saved_at ?? d.created_at ?? null) as string | null,
            deal_status: d.deal_status ?? null,
            contacted_at: d.contacted_at ?? null,
            last_action_at: d.last_action_at ?? null,
            action_notes: d.action_notes ?? null,
            property: null,
          };
        }

        const propRes = await backendFetch(`/properties/${encodeURIComponent(propertyId)}`, {
          method: 'GET',
          headers: {
            'content-type': 'application/json',
            'x-clerk-user-id': userId,
          },
        });

        if (!propRes.ok) {
          return {
            id: String(d.id),
            property_id: propertyId,
            saved_at: (d.saved_at ?? d.created_at ?? null) as string | null,
            deal_status: d.deal_status ?? null,
            contacted_at: d.contacted_at ?? null,
            last_action_at: d.last_action_at ?? null,
            action_notes: d.action_notes ?? null,
            property: null,
          };
        }

        const property = await propRes.json().catch(() => null);

        // IMPORTANT: Saved deals often store a metric snapshot in `data` at save-time.
        // Merge those canonical fields into the property payload so the UI can render
        // Yield/ROI even when the properties table is missing rent/yield/roi.
        const propObj: Record<string, any> = isPlainObject(property) ? property : {};
        const dealObj: Record<string, any> = isPlainObject(d as any) ? (d as any) : {};
        const dataObj: Record<string, any> = isPlainObject((d as any)?.data) ? ((d as any).data as any) : {};

        const canonicalKeys = [
          'price',
          'roi_is_proxy',
          'rent_monthly',
          'rent_pcm',
          'yield_percent',
          'rental_yield_percent',
          'roi_percent',
          'bedrooms',
          'bathrooms',
          'postcode',
          'location',
          'title',
          'imageurl',
          'image_url',
          'url',
          'source_url',
          'listing_url',
          'property_url',
          'external_url',
          'original_url',
          'original_listing_url',
          'rightmove_url',
          'zoopla_url',
          'onthemarket_url',
          'agent_name',
          'agency_name',
          'branch_name',
          'agent_phone',
          'contact_phone',
          'agent_email',
          'contact_email',
          'deal_status',
          'contacted_at',
          'last_action_at',
          'action_notes',
        ];

        mergeMissing(propObj, dealObj, canonicalKeys);
        mergeMissing(propObj, dataObj, canonicalKeys);
        if (d.deal_status) propObj.deal_status = d.deal_status;
        if (d.contacted_at) propObj.contacted_at = d.contacted_at;
        if (d.last_action_at) propObj.last_action_at = d.last_action_at;
        if (d.action_notes) propObj.action_notes = d.action_notes;

        return {
          id: String(d.id),
          property_id: propertyId,
          saved_at: (d.saved_at ?? d.created_at ?? null) as string | null,
          deal_status: d.deal_status ?? propObj.deal_status ?? null,
          contacted_at: d.contacted_at ?? propObj.contacted_at ?? null,
          last_action_at: d.last_action_at ?? propObj.last_action_at ?? null,
          action_notes: d.action_notes ?? propObj.action_notes ?? null,
          property: propObj,
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
        deal_status: d?.deal_status ?? null,
        contacted_at: d?.contacted_at ?? null,
        last_action_at: d?.last_action_at ?? null,
        action_notes: d?.action_notes ?? null,
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
  const userId = await getSafeUserId();
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
    const baseHeaders = {
      'content-type': 'application/json',
      ...internalApiHeaders(),
      'x-propnexus-user-id': userId,
      'x-clerk-user-id': userId,
    };

    // Preferred (per contract): DELETE /save-deal?user_id=<clerkId>&property_id=<uuid>
    let res = await backendFetch(
      `/save-deal?user_id=${encodeURIComponent(userId)}&property_id=${encodeURIComponent(identifier)}`,
      {
        method: 'DELETE',
        headers: baseHeaders,
      },
    );

    // Fallbacks for existing backend routes.
    if (!res.ok) {
      res = await backendFetch(
        `/saved-deal?user_id=${encodeURIComponent(userId)}&property_id=${encodeURIComponent(identifier)}`,
        {
          method: 'DELETE',
          headers: baseHeaders,
        },
      );
    }
    if (!res.ok) {
      res = await backendFetch(`/saved-deals/${encodeURIComponent(identifier)}`, {
        method: 'DELETE',
        headers: baseHeaders,
      });
    }

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
