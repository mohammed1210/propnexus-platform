import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const key = process.env.STRIPE_SECRET_KEY;
const base = process.env.NEXT_PUBLIC_APP_BASE_URL || '';
const allowed = (process.env.NEXT_PUBLIC_STRIPE_ALLOWED_PRICE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

const stripe = key ? new Stripe(key as string, { apiVersion: '2025-09-30.clover' }) : (null as unknown as Stripe);

export async function POST(req: Request) {
  try {
    if (!stripe || !key) return NextResponse.json({ ok:false, error:'Stripe not configured' }, { status: 500 });

    const { priceId } = await req.json();
    if (!priceId || !allowed.includes(priceId)) {
      return NextResponse.json({ ok:false, error:'Invalid or missing priceId' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/billing/cancel`,
      automatic_tax: { enabled: true },
    });

    return NextResponse.json({ ok:true, url: session.url });
  } catch (err:any) {
    console.error('Stripe checkout error', { message: err?.message, code: err?.code, type: err?.type });
    return NextResponse.json({ ok:false, error:'Checkout failed' }, { status: 500 });
  }
}
