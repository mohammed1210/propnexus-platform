import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Force Node runtime and avoid static optimization (important for webhooks).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lazy Stripe init so the build/collect step doesn’t require secrets.
let stripeSingleton: Stripe | null = null;
function getStripe(): Stripe | null {
  if (stripeSingleton) return stripeSingleton;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  // Use the types’ latest tag to satisfy @types/stripe during builds.
  stripeSingleton = new Stripe(key, { apiVersion: '2025-09-30.clover' });
  return stripeSingleton;
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();

  // In CI/preview without secrets, acknowledge to keep endpoint idempotent.
  if (!stripe) {
    return NextResponse.json({ received: true, skipped: 'no-stripe' });
  }

  const signature = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing webhook config' }, { status: 400 });
  }

  // Read raw body text for signature verification
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('stripe webhook signature error:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const logData = {
          event_type: event.type,
          customer: session.customer,
          subscription: session.subscription,
          email: session.customer_details?.email,
          timestamp: new Date().toISOString(),
        };
        console.log('[Stripe Webhook] Checkout completed:', logData);
        // Backend webhook handles the actual subscription activation
        // This frontend webhook is primarily for logging/monitoring
        // TODO: Consider sending to monitoring service (e.g., Sentry, Datadog)
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const logData = {
          event_type: event.type,
          id: subscription.id,
          customer: subscription.customer,
          status: subscription.status,
          timestamp: new Date().toISOString(),
        };
        console.log(`[Stripe Webhook] Subscription ${event.type}:`, logData);
        // TODO: Consider sending to monitoring service (e.g., Sentry, Datadog)
        break;
      }
      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const error = err as Error;
    console.error('[Stripe Webhook] Handler error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    // TODO: Send error to monitoring service
    return NextResponse.json({ error: 'handler-error' }, { status: 500 });
  }
}
