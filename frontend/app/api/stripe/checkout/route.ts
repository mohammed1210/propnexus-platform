import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// ✅ ensure Serverless/Node runtime (Stripe SDK cannot run on Edge)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const key = process.env.STRIPE_SECRET_KEY;

const stripe = key
  ? new Stripe(key as string, { apiVersion: '2025-09-30.clover' as Stripe.StripeConfig['apiVersion'] })
  : (null as unknown as Stripe);

// TEMP health endpoint so we can verify envs at runtime in Production
export async function GET() {
  return NextResponse.json({
    routeVersion: 'v3',
    haveKey: !!key,
    allowed: process.env.NEXT_PUBLIC_STRIPE_ALLOWED_PRICE_IDS || '',
    base: process.env.NEXT_PUBLIC_APP_BASE_URL || '',
    runtime: 'nodejs',
  });
}

export async function POST(req: Request) {
  try {
    if (!key) {
      console.error('Checkout: STRIPE_SECRET_KEY missing at runtime');
      return NextResponse.json({ ok: false, error: 'Stripe not configured' }, { status: 500 });
    }

    const { priceId, email } = await req.json().catch(() => ({ priceId: undefined, email: undefined }));

    // Allow-list of price IDs (CSV)
    const allowed = (process.env.NEXT_PUBLIC_STRIPE_ALLOWED_PRICE_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!priceId || !allowed.includes(priceId)) {
      console.error('Checkout validation failed', { priceId, allowed });
      return NextResponse.json({ error: 'Invalid or missing priceId' }, { status: 400 });
    }

    const origin =
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_BASE_URL ||
      'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      billing_address_collection: 'auto',
      customer_email: email || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancelled`,
      automatic_tax: { enabled: true },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe checkout error', {
      message: err?.message,
      code: err?.code,
      type: err?.type,
    });
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
