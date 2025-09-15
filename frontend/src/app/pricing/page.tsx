"use client";
import { useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL!;

// TODO: replace with your real test price IDs from Stripe
const PLANS = [
  { name: "Starter", priceId: "price_test_STARTER", price: "£19/mo" },
  { name: "Pro",     priceId: "price_test_PRO",     price: "£49/mo" },
];

export default function Pricing() {
  const [loading, setLoading] = useState<string | null>(null);

  async function startCheckout(priceId: string) {
    try {
      setLoading(priceId);
      // TODO: swap this with the signed-in user's email
      const customer_email = "test@example.com";

      const res = await fetch(`${BACKEND}/stripe/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price_id: priceId, customer_email, mode: "subscription" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      console.error(e);
      alert("Checkout failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-semibold mb-6">Choose a plan</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {PLANS.map(p => (
          <div key={p.priceId} className="rounded border p-4">
            <div className="text-xl font-medium">{p.name}</div>
            <div className="text-2xl my-2">{p.price}</div>
            <button
              className="rounded bg-black text-white px-4 py-2"
              onClick={() => startCheckout(p.priceId)}
              disabled={loading === p.priceId}
            >
              {loading === p.priceId ? "Redirecting…" : "Subscribe"}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}