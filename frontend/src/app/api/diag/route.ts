// /api/diag
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  let supabaseOk = false;
  let count: number | null = null;
  let error: string | null = null;

  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { count: c, error: e } = await sb
      .from('properties')
      .select('id', { count: 'exact', head: true });

    if (e) error = e.message;
    supabaseOk = !e;
    count = c ?? null;
  } catch (e: any) {
    error = e?.message ?? String(e);
  }

  return NextResponse.json({
    ok: env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY && supabaseOk,
    env,
    supabase: { ok: supabaseOk, propertiesCount: count, error },
    ts: new Date().toISOString(),
  });
}
