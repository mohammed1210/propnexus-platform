"use client";

import * as React from "react";
import { ClerkProvider } from "@clerk/nextjs";

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

  return <ClerkProvider>{children}</ClerkProvider>;
}
