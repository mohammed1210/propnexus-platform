"use client";

import React from "react";

function hasValidClerkKey(key?: string) {
  if (!key) return false;
  const k = key.trim();
  if (!k) return false;
  if (k.toLowerCase().includes("your_") || k.toLowerCase().includes("placeholder"))
    return false;
  return true;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const enableClerk = hasValidClerkKey(publishableKey);

  // IMPORTANT: don't mount Clerk at all in CI/preview without a valid key
  if (!enableClerk) return <>{children}</>;

  // Lazy require so environments without Clerk don't even evaluate it
  // @ts-ignore
  const { ClerkProvider } = require("@clerk/nextjs");

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={{
        layout: { logoPlacement: "outside", helpPageUrl: "/help" },
        variables: {
          colorPrimary: "#148898",
          borderRadius: "12px",
          fontFamily: "Inter, system-ui, sans-serif",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
