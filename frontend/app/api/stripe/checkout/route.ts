// app/api/stripe/checkout/route.ts
import { NextRequest } from 'next/server';

/**
 * Minimal proxy for Stripe checkout creation.
 * Tries known backend checkout endpoints in order and forwards the JSON body.
 * Works in previews (avoids cross-origin) and production.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backend) {
      return new Response(JSON.stringify({ error: 'NEXT_PUBLIC_BACKEND_URL not set' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Keep checkout ownership explicit. Portal creation stays on /api/stripe/portal.
    const candidates = [
      '/stripe/checkout', // if you implemented this
      '/stripe/create-checkout-session', // common name
    ];

    for (const path of candidates) {
      try {
        const r = await fetch(`${backend}${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (r.ok) {
          // Return JSON (e.g., { url })
          const data = await r.json().catch(() => ({}));
          return new Response(JSON.stringify(data), {
            status: r.status,
            headers: { 'content-type': 'application/json' },
          });
        }

        // If not 404, bubble the error back (useful for Stripe messages)
        if (r.status !== 404) {
          const text = await r.text();
          return new Response(text, { status: r.status });
        }
        // else: try next candidate
      } catch {
        // try next candidate
      }
    }

    return new Response(JSON.stringify({ error: 'No Stripe endpoint found on backend' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Unexpected error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
