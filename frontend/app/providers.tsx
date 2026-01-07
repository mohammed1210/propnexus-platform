"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ReactNode } from "react";

function hasValidClerkKey(pk?: string): boolean {
  // Check if key exists and has valid format (not a dummy key)
  return Boolean(pk && (pk.startsWith("pk_test_") || pk.startsWith("pk_live_")) && pk.length > 25);
}

export default function Providers({ children }: { children: ReactNode }) {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const isValidKey = hasValidClerkKey(pk);

  // If no valid Clerk key is configured, skip ClerkProvider entirely
  // This allows builds to succeed in CI without Clerk credentials
  if (!isValidKey) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={pk}
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
