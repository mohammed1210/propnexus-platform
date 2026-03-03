"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "propnexus-high-contrast";

export default function ContrastToggle() {
  const t = useTranslations("header.contrast");
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setMounted(true);
    const root = document.documentElement;
    const stored = localStorage.getItem(STORAGE_KEY) === "true";
    const fromClass = root.classList.contains("high-contrast");
    const next = stored || fromClass;
    setEnabled(next);
    root.classList.toggle("high-contrast", next);
  }, []);

  const toggle = () => {
    const root = document.documentElement;
    const next = !enabled;
    setEnabled(next);
    root.classList.toggle("high-contrast", next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  if (!mounted) {
    return (
      <button
        className="rounded-md h-10 px-3 inline-flex items-center text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors opacity-0"
        aria-label={t("enable")}
      >
        <span className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      className="rounded-md h-10 px-3 inline-flex items-center gap-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
      aria-label={enabled ? t("disable") : t("enable")}
      title={enabled ? t("disable") : t("enable")}
    >
      <span aria-hidden="true">◐</span>
      <span>{enabled ? t("on") : t("off")}</span>
    </button>
  );
}
