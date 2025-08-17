// src/app/api/save-deal/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'; // don't statically cache
export const runtime = 'nodejs';        // ensure node runtime for server libs

type SaveDealPayload = Record<string, any>;

export async function POST(req: Request) {
  // Prefer service-role (for server-side inserts), fall back to anon if needed.
  const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const SUPABASE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

  // Allow table override via env, default to 'saved_deals'
  const TABLE = process.env.SUPABASE_TABLE || 'saved_deals';

  // If env vars are missing, **do not throw** — return a 500 JSON so the build won’t fail.
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json(
      {
        error: 'Missing Supabase environment variables',
        required: [
          'NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)',
          'SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY)',
        ],
        hint:
          'Set these in Vercel → Project → Settings → Environment Variables, then redeploy.',
      },
      { status: 500 }
    );
  }

  try {
    const body = (await req.json()) as SaveDealPayload;

    // Basic payload guard (optional)
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid payload: expected JSON object.' },
        { status: 400 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase.from(TABLE).insert([body]).select();

    if (error) {
      return NextResponse.json(
        { error: 'Supabase insert failed', detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, table: TABLE, rows: data ?? [] },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Unexpected server error', detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
