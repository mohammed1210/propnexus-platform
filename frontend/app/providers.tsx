"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { isValidClerkKey } from "@/lib/clerk-utils";

export default function Providers({ children }: { children: React.ReactNode }) {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // Only wrap with ClerkProvider if we have a valid key
  // This allows the app to build without Clerk in CI/CD environments
  if (!isValidClerkKey(pk)) {
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
