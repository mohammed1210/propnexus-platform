"use client";

import Link from "next/link";
import { fetchWithRetry } from '@/lib/api';
import Image from "next/image";
import { useCallback, useMemo, useState } from "react";

// tiny classnames helper – keeps conditional class logic tidy
function cx(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ");
}

type Property = {
  id: string;
  title: string;
  location?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  imageurl?: string | null;
};

/** Resolve the FastAPI base URL from public env (trim TRAILING slashes only) */
function getBackendBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "") as string;

  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_API_URL (or NEXT_PUBLIC_BACKEND_URL) is not set"
    );
  }
  // Keep https:// and path segments intact; only strip trailing slashes.
  return raw.replace(/\/+$/, "");
}

/** JSON POST with timeout + small retry for resilience */
async function postJSON<T>(
  url: string,
  body: unknown,
  {
    timeoutMs = 10000,
    retries = 1,
  }: { timeoutMs?: number; retries?: number } = {}
): Promise<T> {
  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= retries) {
    const controller =
      typeof AbortController !== "undefined"
        ? new AbortController()
        : undefined;
    const id = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

    try {
      const res = await fetchWithRetry(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller?.signal,
      });
      if (!res.ok) {
        // retry only on transient-ish codes
        if (![408, 429, 500, 502, 503, 504].includes(res.status) || attempt === retries) {
          throw new Error(`POST ${url} failed (${res.status})`);
        }
        throw new Error(`retryable-${res.status}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      attempt += 1;
      if (attempt > retries) break;
      // jittered backoff
      await new Promise((r) =>
        setTimeout(r, 300 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200))
      );
    } finally {
      if (id) clearTimeout(id);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export default function PropertyCard({ p }: { p: Property }) {
  const [saving, setSaving] = useState(false);

  const priceText = useMemo(() => {
    const n = p.price ?? 0;
    try {
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `£${Number(n).toLocaleString()}`;
    }
  }, [p.price]);

  const href = useMemo(
    () => `/property/${encodeURIComponent(p.id)}`,
    [p.id]
  );

  const handleSaveDeal = useCallback(async () => {
    try {
      setSaving(true);
      const base = getBackendBase();
      await postJSON<{ ok: boolean }>(`${base}/save-deal`, {
        property_id: p.id,
      });
      alert("Deal saved!");
    } catch (e) {
      console.error(e);
      alert("Could not save this deal.");
    } finally {
      setSaving(false);
    }
  }, [p.id]);

  return (
    <article className="card p-0 overflow-hidden">
      <Link
        href={href}
        className="block relative w-full h-48 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`Open ${p.title ?? "property"}`}
      >
        <Image
          src={p.imageurl || "/placeholder.jpg"}
          alt={p.title || "Property image"}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          style={{ objectFit: "cover" }}
          priority={false}
        />
      </Link>

      <div className="p-4 space-y-2">
        <Link href={href} className="block group">
          <h3 className="font-semibold leading-snug line-clamp-2 group-hover:underline">
            {p.title || "Untitled property"}
          </h3>
        </Link>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {p.location || "—"}
        </p>

        <div className="flex items-center justify-between pt-2">
          <div className="text-sm">
            <span className="font-medium">{priceText}</span>
            <span className="opacity-60 ml-2">
              {p.bedrooms ?? "—"} bd · {p.bathrooms ?? "—"} ba
            </span>
          </div>

          <button
            type="button"
            onClick={handleSaveDeal}
            disabled={saving}
            className={cx(
              "rounded-md px-3 py-1.5 text-sm border transition",
              "hover:bg-zinc-100 dark:hover:bg-zinc-800",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              saving && "opacity-60 cursor-not-allowed"
            )}
            aria-label={saving ? "Saving deal" : "Save deal"}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </article>
  );
}
