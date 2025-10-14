import { fetchWithRetry } from "@/lib/api";
import type { NextRequest } from "next/server";

/**
 * Relaxed context typing — we only need params.pc.
 */
export async function GET(_req: NextRequest, ctx: any) {
  const pc = ctx?.params?.pc as string;
  const base =
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_BASE ??
    "";

  const upstream = `${base.replace(/\/+$/, "")}/comps/${encodeURIComponent(pc)}`;

  try {
    const res = await fetchWithRetry(
      upstream,
      { headers: { accept: "application/json" } },
      { timeoutMs: 10_000 }
    );
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        "content-type":
          res.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": res.headers.get("cache-control") || "no-store",
      },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Upstream /comps failed" }),
      {
        status: 502,
        headers: { "content-type": "application/json; charset=utf-8" },
      }
    );
  }
}
