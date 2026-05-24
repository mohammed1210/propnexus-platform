"use client";

import { useState } from "react";
import { FiMapPin, FiPlayCircle } from "react-icons/fi";
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
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/35 dark:text-emerald-200 dark:ring-emerald-900/50">
            <FiPlayCircle className="h-4 w-4" aria-hidden />
          </div>
          <h2 className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">Admin Tools</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Trigger the backend “Import All” job via a proper POST.
          </p>
        </div>
        {lastRunAt ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
            <span className="block font-semibold text-slate-900 dark:text-white">Last run</span>
            <span>{new Date(lastRunAt).toLocaleString()}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Location
          </label>
          <div className="mt-1 flex items-center rounded-lg border border-slate-300 bg-white px-3 shadow-sm transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950">
            <FiMapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. London, Manchester, Birmingham"
              className="w-full border-0 bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </div>
        </div>

        <button
          onClick={runImport}
          disabled={isRunning}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          <FiPlayCircle className="h-4 w-4" aria-hidden />
          {isRunning ? "Running…" : "Run Import"}
        </button>
      </div>

      <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
        This calls <span className="font-mono">/api/admin/import-all</span>. Auth is enforced by middleware (Clerk + admin allowlist)
        and the backend token stays server-side.
      </p>
    </div>
  );
}
