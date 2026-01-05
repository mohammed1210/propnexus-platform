"use client";

import { ClerkProvider } from "@clerk/nextjs";

function safeClerkPk(pk?: string) {
  // CI-safe fallback so build/prerender doesn't crash if env isn't set in GH Actions
  if (pk && (pk.startsWith("pk_test_") || pk.startsWith("pk_live_"))) return pk;
  return "pk_test_ci_dummy_key_1234567890";
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <ClerkProvider
      publishableKey={safeClerkPk(pk)}
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
