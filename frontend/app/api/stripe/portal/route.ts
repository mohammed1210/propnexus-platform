import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEY = process.env.STRIPE_SECRET_KEY;
const BASE = process.env.NEXT_PUBLIC_APP_BASE_URL ?? '';

/**
 * TODO: Replace with a real lookup that maps the signed-in user
 * to their Stripe customer ID (e.g., from your DB via webhook sync).
 */
async function getCustomerIdForCurrentUser(): Promise<string | null> {
  // Return null until you store/lookup real Stripe customer IDs.
  return null;
}

export async function POST() {
  try {
    if (!KEY) {
      return NextResponse.json({ ok: false, error: 'Stripe not configured' }, { status: 500 });
    }

    const stripe = new Stripe(KEY, { apiVersion: '2025-09-30.clover' });

    const customer = await getCustomerIdForCurrentUser();
    if (!customer) {
      // Keep types happy and avoid calling the API without a customer.
      return NextResponse.json(
        { ok: false, error: 'No Stripe customer on file for this user.' },
        { status: 400 },
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${BASE || 'http://localhost:3000'}/billing/account`,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err: any) {
    console.error('Stripe portal error', {
      message: err?.message,
      code: err?.code,
      type: err?.type,
    });
    return NextResponse.json({ ok: false, error: 'Portal failed' }, { status: 500 });
  }
}
