import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Minimal validation
    const property_id = String(body?.property_id ?? "").trim();
    if (!property_id) {
      return NextResponse.json({ error: "property_id is required" }, { status: 400 });
    }

    const payload = {
      property_id,
      title: body?.title ?? null,
      location: body?.location ?? null,
      postcode: body?.postcode ?? null,
      price: body?.price ?? null,
      yield_percent: body?.yield_percent ?? null,
      roi_percent: body?.roi_percent ?? null,
      source: body?.source ?? null,
      notes: body?.notes ?? null,
    };

    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from("deals")
      .upsert(payload, { onConflict: "property_id" })
      .select()
      .single();

    if (error) {
      console.error("supabase upsert error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deal: data });
  } catch (e: any) {
    console.error("save-deal route error", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
