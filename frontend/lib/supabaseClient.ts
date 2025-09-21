'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _sb: SupabaseClient | null = null;

/** Get a Supabase client if env vars exist; otherwise return a no-op shim. */
export function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anon) {
    if (!_sb) _sb = createClient(url, anon);
    return _sb!;
  }

  if (typeof window !== 'undefined') {
    console.warn('Supabase env vars are missing; using a no-op client.');
  }

  const shim = {
    from() {
      return {
        select: async () => ({ data: [], error: null }),
        insert: async () => ({ data: null, error: new Error('Supabase disabled (missing env)') }),
        update: async () => ({ data: null, error: new Error('Supabase disabled (missing env)') }),
        delete: async () => ({ data: null, error: new Error('Supabase disabled (missing env)') }),
      };
    },
  };

  return shim as unknown as SupabaseClient;
}
