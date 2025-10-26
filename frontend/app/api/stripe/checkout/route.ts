import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Stripe not configured" },
      { status: 503 },
    );
  }

const stripe = new Stripe(key, {
  apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
});

  const { email } = await req.json().catch(() => ({ email: undefined }));
  const price = process.env.STRIPE_PRICE_PRO_MONTH as string;
  const origin =
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
    req.headers.get("origin") ||
    "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    billing_address_collection: "auto",
    customer_email: email || undefined,
    line_items: [{ price, quantity: 1 }],
    success_url: `${origin}/checkout/success`,
    cancel_url: `${origin}/pricing?cancelled=1`,
  });

  return NextResponse.json({ url: session.url }, { status: 200 });
}
