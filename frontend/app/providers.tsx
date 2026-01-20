"use client";

import * as React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { isAuthEnabled } from "@/lib/auth";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Helpful runtime debug: confirms env var is truly present client-side on Vercel
  React.useEffect(() => {
    const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    if (!pk) {
      console.warn(
        "[AUTH] Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY on client. " +
          "Check Vercel env vars (Production + Preview) and redeploy with Clear Cache."
      );
    }
  }, []);

  // Prevent CI/SSG failures: ClerkProvider throws if publishableKey is missing.
  // If auth is disabled (or key missing), render without Clerk.
  if (!isAuthEnabled) {
    return <>{children}</>;
  }

  return <ClerkProvider>{children}</ClerkProvider>;
}
