import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

// Avoid static optimization and import-time env checks in CI
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  const price = process.env.STRIPE_PRICE_PRO_MONTH;
  const origin =
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
    req.headers.get("origin") ||
    "http://localhost:3000";

  if (!key || !price) {
    return NextResponse.json(
      { ok: false, error: "Stripe not configured" },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = (body?.email as string | undefined) || undefined;

  // Instantiate inside the handler so Next doesn't try to validate key at build
  const stripe = new Stripe(key as string, {
    apiVersion: "2024-06-20" as any,
  });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    billing_address_collection: "auto",
    customer_email: email,
    line_items: [{ price, quantity: 1 }],
    success_url: `${origin}/checkout/success`,
    cancel_url: `${origin}/pricing?cancelled=1`,
  });

  return NextResponse.json({ url: session.url }, { status: 200 });
}
