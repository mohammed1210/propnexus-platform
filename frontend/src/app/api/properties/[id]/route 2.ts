// /frontend/src/app/api/properties/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  console.log("🔍 Property API called with ID:", id);

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .single(); // returns a single object or throws error

  console.log("🎯 Supabase returned:", data);

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Property not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}