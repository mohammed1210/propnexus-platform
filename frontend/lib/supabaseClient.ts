// frontend/lib/supabaseClient.ts
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '../types/supabase'; // adjust path if needed

export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
