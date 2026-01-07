"use client";

import React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import UiOverlaysClient from "@components/ui/UiOverlaysClient";
import BackToTop from "@components/BackToTop";
import Header from "@components/Header";
import Footer from "@components/Footer";
import { ThemeProvider } from "@components/ThemeProvider";
import { Toaster } from "sonner";
import EnvValidator from "@components/EnvValidator";
import { hasValidClerkKey } from "@/lib/clerk-utils";

function MaybeClerkProvider({ children }: { children: React.ReactNode }) {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // ✅ CI-safe: do NOT mount Clerk if key is missing or placeholder
  if (!hasValidClerkKey(pk)) {
    return <>{children}</>;
  }

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
      <ThemeProvider>
        <EnvValidator />
        <Header />

        <main id="main" className="flex-1 focus:outline-none">
          {children}
        </main>

        <Footer />
        <UiOverlaysClient />
        <BackToTop />
        <Toaster position="top-right" richColors />
      </ThemeProvider>
    </MaybeClerkProvider>
  );
}
