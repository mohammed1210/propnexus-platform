import Stripe from 'stripe';

/**
 * If STRIPE_SECRET_KEY exists and looks like an sk_* key, export a configured
 * Stripe instance. Otherwise export `null` so server code can short-circuit
 * safely in CI/preview environments without secrets.
 */
const secret = process.env.STRIPE_SECRET_KEY;

const stripe =
  secret && secret.startsWith('sk_')
    ? new Stripe(secret, { apiVersion: '2024-06-20' })
    : null;

export type { Stripe };
export default stripe;
