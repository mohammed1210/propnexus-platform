import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const key = process.env.STRIPE_SECRET_KEY;
const base = process.env.NEXT_PUBLIC_APP_BASE_URL || '';
const stripe = key ? new Stripe(key as string, { apiVersion: '2025-09-30.clover' }) : (null as unknown as Stripe);

// NOTE: replace this with your real "lookup" for the Stripe customer ID from your auth/session DB.
async function getCustomerIdForCurrentUser(): Promise<string|null> {
  // TEMP: return null to force portal creation via latest session if available.
  return null;
}

export async function POST() {
  try {
    if (!stripe || !key) return NextResponse.json({ ok:false, error:'Stripe not configured' }, { status: 500 });

    const customer = await getCustomerIdForCurrentUser();

    const session = await stripe.billingPortal.sessions.create({
      customer: customer || undefined,
      return_url: `${base}/billing/account`,
    });

    return NextResponse.json({ ok:true, url: session.url });
  } catch (err:any) {
    console.error('Stripe portal error', { message: err?.message, code: err?.code, type: err?.type });
    return NextResponse.json({ ok:false, error:'Portal failed' }, { status: 500 });
  }
}
