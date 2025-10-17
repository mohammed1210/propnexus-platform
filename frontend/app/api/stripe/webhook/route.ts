import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
// server-only import
import stripe, { Stripe as StripeSDK } from '../../../../lib/stripe';

/**
 * POST /api/stripe/webhook
 * Verifies signature and acknowledges events.
 * Returns { received: true } or { error } with appropriate status.
 */
export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // If Stripe isn't configured, acknowledge so previews never 500.
  if (!webhookSecret || !stripe) {
    return NextResponse.json({ received: true, note: 'Stripe not configured' });
  }

  // Next 15: headers() is async
  const h = await headers();
  const signature = h.get('stripe-signature');
  const body = await req.text();

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const s = stripe as StripeSDK;

  try {
    const event = s.webhooks.constructEvent(body, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed':
        console.log('Checkout session completed:', event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Error verifying Stripe webhook', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
}
