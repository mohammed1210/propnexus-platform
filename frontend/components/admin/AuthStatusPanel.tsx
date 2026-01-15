"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type AuthDebugPayload = {
  disableAuthRaw: string;
  disableAuthParsed: boolean;
  isAuthEnabled: boolean;
  isAuthEnabledClient?: boolean;
  vercelEnv: string | null;
  commitSha: string | null;
  clerk: {
    hasPublishableKey: boolean;
    hasValidPublishableKey: boolean;
    publishableKeyPrefix?: string | null;
    publishableKeyLength?: number;
    publishableKeyHasWhitespace?: boolean;
    hasSecretKey: boolean;
  };
  whoami: {
    userId: string | null;
    email: string | null;
    sessionId: string | null;
    error?: string;
  };
};

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " +
        (ok
          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200"
          : "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200")
      }
    >
      {label}
    </span>
  );
}

export default function AuthStatusPanel() {
  const [data, setData] = useState<AuthDebugPayload | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/debug/auth", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as AuthDebugPayload | null;
      if (!res.ok || !json) {
        throw new Error((json as any)?.error || `Failed (${res.status})`);
      }
      setData(json);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load auth status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pretty = useMemo(() => (data ? JSON.stringify(data, null, 2) : ""), [data]);

  async function copyJson() {
    if (!pretty) return;
    try {
      await navigator.clipboard.writeText(pretty);
      toast.success("Auth JSON copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Auth Status</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Live runtime snapshot from <span className="font-mono">/api/debug/auth</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={copyJson}
            disabled={!data}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Copy JSON
          </button>
        </div>
      </div>

      {data ? (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge ok={data.isAuthEnabled} label={data.isAuthEnabled ? "Auth Enabled" : "Auth Disabled"} />
              <Badge ok={!!data.clerk.hasPublishableKey} label={data.clerk.hasPublishableKey ? "PK present" : "PK missing"} />
              <Badge
                ok={!!data.clerk.hasValidPublishableKey}
                label={data.clerk.hasValidPublishableKey ? "PK valid" : "PK invalid"}
              />
              <Badge ok={!!data.clerk.hasSecretKey} label={data.clerk.hasSecretKey ? "SK present" : "SK missing"} />
            </div>

            <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-300">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Vercel</span>
                <span className="font-mono">{data.vercelEnv ?? "(unknown)"}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-semibold">Commit</span>
                <span className="font-mono">{data.commitSha?.slice(0, 7) ?? "(unknown)"}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-semibold">Disable Auth</span>
                <span className="font-mono">{`${data.disableAuthRaw} → ${String(data.disableAuthParsed)}`}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-semibold">PK Prefix/Len</span>
                <span className="font-mono">
                  {data.clerk.publishableKeyPrefix ?? "(none)"}/{data.clerk.publishableKeyLength ?? 0}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-semibold">PK Whitespace</span>
                <span className="font-mono">{String(!!data.clerk.publishableKeyHasWhitespace)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">whoami</p>
              <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                <span className="font-semibold">User ID:</span> {data.whoami.userId ?? "(none)"}
              </p>
              <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                <span className="font-semibold">Email:</span> {data.whoami.email ?? "(none)"}
              </p>
              {data.whoami.error ? (
                <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">{data.whoami.error}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Loading…</div>
      )}
    </div>
  );
}
