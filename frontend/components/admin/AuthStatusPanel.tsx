"use client";

import { useEffect, useMemo, useState } from "react";
import { FiCopy, FiRefreshCw, FiShield } from "react-icons/fi";
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
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 " +
        (ok
          ? "bg-emerald-50 text-emerald-800 ring-emerald-100 dark:bg-emerald-950/35 dark:text-emerald-200 dark:ring-emerald-900/50"
          : "bg-rose-50 text-rose-800 ring-rose-100 dark:bg-rose-950/35 dark:text-rose-200 dark:ring-rose-900/50")
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
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100 dark:bg-brand-950/40 dark:text-brand-200 dark:ring-brand-900/50">
            <FiShield className="h-4 w-4" aria-hidden />
          </span>
          <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Auth Status</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Live runtime snapshot from <span className="font-mono">/api/debug/auth</span>.
          </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={copyJson}
            disabled={!data}
            className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <FiCopy className="h-4 w-4" aria-hidden />
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

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
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
            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/30">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">whoami</p>
              <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                <span className="font-semibold">User ID:</span> {data.whoami.userId ?? "(none)"}
              </p>
              <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                <span className="font-semibold">Email:</span> {data.whoami.email ?? "(none)"}
              </p>
              {data.whoami.error ? (
                <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">{data.whoami.error}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">Loading…</div>
      )}
    </div>
  );
}
