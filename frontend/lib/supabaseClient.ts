// lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Get a singleton Supabase client (browser only). */
export function getSupabase(): SupabaseClient {
  if (typeof window === 'undefined') {
    // Guard against being called during SSR/prerender.
    throw new Error('getSupabase() called on the server');
  }
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    client = createClient(url, key);
  }
  return client;
}