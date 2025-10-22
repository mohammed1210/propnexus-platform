// frontend/lib/stripe.ts
// ============================================================
// Stripe integration for both API routes and frontend helpers
// ============================================================

import Stripe from 'stripe';

/**
 * Server-side Stripe client instance.
 * Uses secret key only available on the backend.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: Stripe.LatestApiVersion, // ✅ Fixes type issue for current SDK
});

/**
 * Helper: initiate checkout session from the frontend.
 * Calls FastAPI backend endpoint `/stripe/checkout`.
 */
// Frontend helper to call our FastAPI checkout endpoint
export async function startCheckout(opts: { priceId: string; email?: string }) {
  const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
  const res = await fetch(`${API}/stripe/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })

  if (!res.ok) {
    throw new Error(`Checkout failed (${res.status})`);
  }

  return res.json() as Promise<{ id: string; url: string }>;
}

// Export default for backward compatibility (e.g. import stripe from '@/lib/stripe')
export default stripe;
