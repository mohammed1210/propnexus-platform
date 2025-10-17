import Stripe from 'stripe';

/**
 * Return a configured Stripe instance when STRIPE_SECRET_KEY exists and
 * looks like an `sk_...` key. Otherwise export `null` so server code can
 * gracefully short-circuit in non-secret environments (CI/preview).
 */
const secret = process.env.STRIPE_SECRET_KEY;

const stripe =
  secret && secret.startsWith('sk_')
    ? new Stripe(secret, { apiVersion: '2024-06-20' })
    : null;

export type { Stripe };
export default stripe;
