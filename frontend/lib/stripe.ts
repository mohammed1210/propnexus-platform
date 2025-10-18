import Stripe from 'stripe';

/**
 * Returns a configured Stripe instance when STRIPE_SECRET_KEY looks like an `sk_...` key.
 * Otherwise export `null` so server code can short-circuit in preview/CI.
 */
const secret = process.env.STRIPE_SECRET_KEY ?? null;

const stripe =
  secret && secret.startsWith('sk_')
    ? new Stripe(secret, { apiVersion: '2025-09-30.clover' })
    : null;

export type { Stripe };
export default stripe;
