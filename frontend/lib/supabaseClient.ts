// lib/supabaseClient.ts
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { type SupabaseClient } from '@supabase/supabase-js';

const supabase = createBrowserSupabaseClient();

export default supabase as SupabaseClient;
