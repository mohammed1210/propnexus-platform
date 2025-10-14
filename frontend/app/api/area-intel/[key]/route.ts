import { fetchWithRetry } from "@/lib/api";
import type { NextRequest } from "next/server";

/**
 * Keep typing relaxed for Next 15 route handler context to avoid TS mismatch.
 * At runtime we only need params.key.
 */
export async function GET(_req: NextRequest, ctx: any) {
  const key = ctx?.params?.key as string;
  const base =
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_BASE ??
    "";

  const upstream = `${base.replace(/\/+$/, "")}/area-intel/${encodeURIComponent(
    key
  )}`;

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
      JSON.stringify({ error: e?.message || "Upstream /area-intel failed" }),
      {
        status: 502,
        headers: { "content-type": "application/json; charset=utf-8" },
      }
    );
  }
}
