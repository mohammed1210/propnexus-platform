// frontend/lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');

// Frontend helper to call our FastAPI checkout endpoint
export async function startCheckout(opts: { priceId: string; email?: string }) {
  const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
  const res = await fetch(`${API}/stripe/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(`Checkout failed (${res.status})`);
  return res.json() as Promise<{ id: string; url: string }>;
}

export default stripe;
