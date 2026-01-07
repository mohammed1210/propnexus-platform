"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ReactNode } from "react";
import { hasValidClerkKey } from "@/lib/clerk-utils";

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
