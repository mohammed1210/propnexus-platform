"use client";

import { useEffect, useRef, useState } from "react";

export default function AIScoreInfo({
  triggerClassName = "mt-2 inline-flex items-center gap-1 text-sm underline text-gray-600",
}: { triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open && dialogRef.current) {
      const el = dialogRef.current.querySelector<HTMLElement>('[data-autofocus="true"]');
      el?.focus();
    } else if (!open && btnRef.current) {
      btnRef.current.focus();
    }
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        className={triggerClassName}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        ❓ What do these scores mean?
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-score-info-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            ref={dialogRef}
            className="w-full max-w-md rounded-lg bg-white dark:bg-neutral-900 shadow-xl border border-neutral-200 dark:border-neutral-800 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="ai-score-info-title" className="text-lg font-semibold mb-2">
              🧠 How we calculate the AI Deal Score
            </h3>

            <div className="space-y-2 text-sm text-neutral-700 dark:text-neutral-200">
              <p>
                The overall score blends four signals: <strong>Yield</strong>, <strong>ROI</strong>, <strong>Area
                Demand</strong>, and <strong>Risk</strong>.
              </p>
              <ul className="list-disc pl-5">
                <li><strong>Yield</strong>: gross yield vs. typical local ranges.</li>
                <li><strong>ROI</strong>: projected return given refurb &amp; exit assumptions.</li>
                <li><strong>Area Demand</strong>: local rental demand/comps (illustrative for now).</li>
                <li><strong>Risk</strong>: down‑valuation, cost overrun, void risk (illustrative for now).</li>
              </ul>
              <p className="text-xs text-neutral-500">
                Scores are indicative only. Always validate with your own numbers and due diligence.
              </p>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                data-autofocus="true"
                className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}