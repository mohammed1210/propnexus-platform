// frontend/lib/supabaseClient.ts
'use client';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { type Database } from '../types/supabase';

export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
