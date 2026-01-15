"use client";

import { useState } from "react";
import { toast } from "sonner";

export default function RunImportPanel() {
  const [location, setLocation] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);

  async function runImport() {
    const trimmed = location.trim();
    if (!trimmed) {
      toast.error("Enter a location first");
      return;
    }

    setIsRunning(true);
    const t = toast.loading("Starting import…");

    try {
      const res = await fetch("/api/admin/import-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ location: trimmed }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.dismiss(t);
        toast.error(data?.error || `Import failed (${res.status})`);
        return;
      }

      toast.dismiss(t);
      setLastRunAt(new Date().toISOString());
      toast.success(data?.message || "Import started successfully");
    } catch (err: any) {
      toast.dismiss(t);
      toast.error(err?.message || "Import request failed");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Admin Tools</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Trigger the backend “Import All” job via a proper POST.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Location
          </label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. London, Manchester, Birmingham"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>

        <button
          onClick={runImport}
          disabled={isRunning}
          className="btn-primary px-5 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isRunning ? "Running…" : "Run Import"}
        </button>
      </div>

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        This calls <span className="font-mono">/api/admin/import-all</span>. Auth is enforced by middleware (Clerk + admin allowlist)
        and the backend token stays server-side.
      </p>

      {lastRunAt ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Last run: <span className="font-mono">{new Date(lastRunAt).toLocaleString()}</span>
        </p>
      ) : null}
    </div>
  );
}
