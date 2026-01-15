"use client";

import * as React from "react";
import { ClerkProvider } from "@clerk/nextjs";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Client-side visibility check (helps debug Vercel env replacement)
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  React.useEffect(() => {
    if (!pk) {
      console.warn(
        "[AUTH] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing on client. " +
          "Check Vercel env vars (Production + Preview) and redeploy with Clear Cache."
      );
    }
  }, [pk]);

  return <ClerkProvider>{children}</ClerkProvider>;
}
