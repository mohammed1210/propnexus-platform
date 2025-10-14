import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
// @ts-ignore - server-only
import stripe from '../../../../lib/stripe';

/**
 * POST /api/stripe/webhook
 * Verifies signature and acknowledges events.
 * Returns { received: true } or { error } with appropriate status.
 */
export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 500 });
  }

  const signature = headers().get('stripe-signature');
  const body = await req.text();

  try {
    const event = stripe.webhooks.constructEvent(body, signature as string, webhookSecret);

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
