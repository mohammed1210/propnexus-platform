"use client";

import { ClerkProvider } from "@clerk/nextjs";

function isUsableClerkPublishableKey(pk?: string) {
  if (!pk) return false;

  const normalized = pk.toLowerCase();
  return (
    pk.startsWith("pk_") &&
    !normalized.includes("dummy") &&
    pk.length > 30
  );
}

export default function Providers({ children }: { children: ReactNode }) {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // ✅ CI-safe Clerk gating:
  // Only mount Clerk if a real publishable key exists.
  // This prevents Next.js prerender/build from crashing in CI.
  if (!isUsableClerkPublishableKey(pk)) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={pk}
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
