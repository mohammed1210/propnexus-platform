"use client";

import { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { hasValidClerkKey } from "@/lib/clerk-utils";

export default function Providers({ children }: { children: ReactNode }) {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // ✅ CI-safe Clerk gating:
  // Only mount Clerk if a real publishable key exists.
  // This prevents Next.js prerender/build from crashing in CI.
  if (!hasValidClerkKey(pk)) {
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
