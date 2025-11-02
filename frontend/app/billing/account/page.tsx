"use client";

import { useEffect, useState } from "react";
import StripePortalButton from "@/components/StripePortalButton";
import Link from "next/link";

async function getUserEmail(): Promise<string | null> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
    if (!url || !key) return null; // CI/preview safety
    const supabase = createClient(url, key);
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export default function BillingAccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      setEmail(await getUserEmail());
      setHydrated(true);
    })();
  }, []);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
        Manage Subscription
      </h1>

      {!hydrated ? (
        <p>Loading…</p>
      ) : email ? (
        <>
          <p style={{ marginBottom: 16 }}>
            Signed in as <strong>{email}</strong>
          </p>

          {/* Shadcn-styled button with spinner + toasts */}
          <StripePortalButton email={email} />
        </>
      ) : (
        <>
          <p style={{ marginBottom: 16 }}>
            You’re not signed in. Use a magic link to sign in, then return here
            to manage your subscription.
          </p>
          <Link
            href="/magic-login"
            className="inline-flex items-center px-4 py-2 rounded-md bg-black text-white hover:bg-zinc-800"
          >
            Send magic link
          </Link>
        </>
      )}
    </main>
  );
}
