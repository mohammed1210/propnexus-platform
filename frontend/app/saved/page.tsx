"use client";

import React from "react";
import { useUser } from "@clerk/nextjs";

import SavedDealsView from "@/components/SavedDeals/SavedDealsView";
import Section from "@/components/ui/Section";

export default function SavedDealsPage() {
  const { isLoaded, isSignedIn } = useUser();

  // Guard rails so we don't render a false empty state before Clerk hydrates.
  if (!isLoaded) {
    return (
      <Section>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-sm">
          Loading your account…
        </div>
      </Section>
    );
  }

  if (!isSignedIn) {
    return (
      <Section>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-sm">
          Please sign in to view your saved deals.
        </div>
      </Section>
    );
  }

  return <SavedDealsView />;
}
