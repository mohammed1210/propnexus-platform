// frontend/lib/supabaseClient.ts
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@types/supabase';

export const supabase = createPagesBrowserClient<Database>({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
});
