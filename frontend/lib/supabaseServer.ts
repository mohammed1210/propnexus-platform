import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl || !serviceKey) {
  throw new Error('Missing Supabase environment variables');
}

export function supabaseServer() {
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}
