// /src/app/api/properties/[id]/route.ts

import { createClient } from '@supabase/supabase-js';

// prevent Next.js from pre-rendering this route at build time
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: any): Promise<Response> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  const id = context.params.id;
  console.log("🔍 Property API called with ID:", id);

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .maybeSingle(); // safer than .single(), avoids 406s

  if (error || !data) {
    return new Response(
      JSON.stringify({ error: error?.message || 'Property not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}