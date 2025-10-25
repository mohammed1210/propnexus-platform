"use client";
import { useState } from "react";

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  const checkout = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const { url } = await r.json();
      window.location.href = url;
    } finally { setLoading(false); }
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-4xl font-bold mb-8">Pricing</h1>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="border rounded-xl p-6">
          <h2 className="text-2xl font-semibold">Free</h2>
          <p className="text-3xl font-bold mt-2">£0<span className="text-base font-medium"> / forever</span></p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>• Browse public deals</li>
            <li>• Basic filters</li>
            <li>• Limited AI score preview</li>
          </ul>
        </div>
        <div className="border-2 border-black rounded-xl p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">Pro</h2>
          <p className="text-3xl font-bold mt-2">£<span className="align-top text-lg">XX</span><span className="text-base font-medium"> / month</span></p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>• Off-Market Deal Generator</li>
            <li>• Full AI scoring + rationale</li>
            <li>• PDF Deal Pack export</li>
            <li>• Alerts + email digests</li>
          </ul>
          <div className="mt-6 space-y-3">
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Email (optional)"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
            />
            <button
              onClick={checkout}
              disabled={loading}
              className="w-full rounded-lg px-4 py-2 bg-black text-white"
            >
              {loading ? "Redirecting…" : "Start Pro"}
            </button>
            <p className="text-xs text-gray-500">No password needed — we’ll send a Magic Link after checkout.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
