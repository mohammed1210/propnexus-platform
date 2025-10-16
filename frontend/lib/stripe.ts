import Stripe from 'stripe';

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

let client: Stripe | null = null;
if (STRIPE_KEY && STRIPE_KEY.startsWith('sk_')) {
  client = new Stripe(STRIPE_KEY);
}

export default client;
export type { Stripe };
