"use client";

import React from "react";
import UiOverlaysClient from "@components/ui/UiOverlaysClient";
import BackToTop from "@components/BackToTop";
import Header from "@components/Header";
import Footer from "@components/Footer";
import { ThemeProvider } from "@components/ThemeProvider";
import { Toaster } from "sonner";
import EnvValidator from "@components/EnvValidator";
import { ClerkProvider } from "@clerk/nextjs";

function isValidClerkPk(pk?: string) {
  if (!pk) return false;
  return pk.startsWith("pk_test_") || pk.startsWith("pk_live_");
}

function MaybeClerkProvider({ children }: { children: React.ReactNode }) {
  // NOTE: This is safe because RootShell is a CLIENT component.
  // In CI, if NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing/placeholder, we avoid mounting Clerk.
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // ✅ CI/prerender-safe: if no valid key, don't mount Clerk at all
  if (!isValidClerkPk(pk)) return <>{children}</>;

  return (
    <ClerkProvider
      publishableKey={pk}
      appearance={{
        layout: {
          logoPlacement: "outside",
          helpPageUrl: "/help",
        },
        variables: {
          colorPrimary: "#148898",
          colorText: "#020617",
          colorBackground: "white",
          borderRadius: "12px",
          fontFamily: "Inter, system-ui, sans-serif",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}

export default function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <MaybeClerkProvider>
      {/* Skip link for a11y */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 bg-zinc-900 text-white px-3 py-2 rounded"
      >
        Skip to content
      </a>

      <ThemeProvider>
        {/* Environment validation in development */}
        <EnvValidator />

        {/* App Header (includes auth controls) */}
        <Header />

        <main id="main" className="flex-1 focus:outline-none">
          {children}
        </main>

        {/* Footer with legal links */}
        <Footer />

        {/* Client-side helpers */}
        <UiOverlaysClient />
        <BackToTop />
        <Toaster position="top-right" richColors />
      </ThemeProvider>
    </MaybeClerkProvider>
  );
}
