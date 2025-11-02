"use client";

import { useEffect, useState } from "react";
import StripePortalButton from "@/components/StripePortalButton";

/**
 * Assumes you’re using Supabase Auth.
 * If you already have a user context/hook, swap the email lookup with that.
 */
async function getUserEmail(): Promise<string | null> {
  try {
    // Lazy import to avoid SSR issues if you’ve already got a client helper, use that instead.
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    );
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic"; // avoids static rendering caching issues

export default function BillingAccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => setEmail(await getUserEmail()))();
  }, []);

  async function openPortal() {
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/stripe/create-portal-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || `Request failed with ${res.status}`);
      }

      const data = await res.json();
      if (data?.url) {
        // Redirect the user to Stripe’s Customer Portal
        window.location.href = data.url;
        return;
      }
      throw new Error("No portal URL returned");
    } catch (e: any) {
      setErrorMsg(e.message || "Could not open customer portal");
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
        Manage Subscription
      </h1>

      <p style={{ marginBottom: 16 }}>
        {email ? (
          <>Signed in as <strong>{email}</strong></>
        ) : (
          <>Fetching your account…</>
        )}
      </p>

      <StripePortalButton email={email || undefined} />

      <button
        onClick={openPortal}
        disabled={!email || loading}
        style={{
          padding: "0.75rem 1.25rem",
          borderRadius: 8,
          border: "none",
          cursor: !email || loading ? "not-allowed" : "pointer",
          opacity: !email || loading ? 0.7 : 1,
          fontWeight: 600,
        }}
      >
        {loading ? "Opening customer portal…" : "Open Customer Portal"}
      </button>

      {errorMsg && (
        <div
          role="alert"
          style={{
            marginTop: 16,
            padding: "12px 14px",
            borderRadius: 8,
            border: "1px solid #f2c6c6",
            background: "#fff5f5",
          }}
        >
          {errorMsg}
        </div>
      )}
    </main>
  );
}
