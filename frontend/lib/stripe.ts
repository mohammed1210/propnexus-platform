import Stripe from 'stripe';

/**
 * Returns a configured Stripe instance if STRIPE_SECRET_KEY looks valid (sk_...),
 * otherwise exports `null` so server routes can short-circuit in CI/preview.
 */
const secret = process.env.STRIPE_SECRET_KEY ?? '';

const stripe = secret.startsWith('sk_') ? new Stripe(secret) : null;

export type { Stripe };
export default stripe;
