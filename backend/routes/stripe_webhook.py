# backend/routes/stripe_webhook.py
from fastapi import APIRouter, Request, Header, HTTPException
from fastapi.responses import JSONResponse
import os, json, stripe
from supabase import create_client, Client
from typing import Optional

router = APIRouter(prefix="/stripe", tags=["stripe"])

# --- ENV VARS ---
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

stripe.api_key = STRIPE_SECRET_KEY

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# --- Helper: store or update customer_id on your users table ---
def save_customer_id_for_user(user_email: str, customer_id: str):
    if not supabase:
        print("⚠️ Supabase client not configured.")
        return

    try:
        response = (
            supabase.table("users")
            .upsert(
                {
                    "email": user_email,
                    "stripe_customer_id": customer_id,
                },
                on_conflict="email",
            )
            .execute()
        )
        print("✅ Supabase upsert success:", response)
    except Exception as e:
        print("❌ Supabase upsert failed:", e)


# --- Stripe Webhook Endpoint ---
@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
):
    payload = await request.body()

    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(
                payload=payload,
                sig_header=stripe_signature,
                secret=STRIPE_WEBHOOK_SECRET,
            )
        else:
            event = json.loads(payload)
    except Exception as e:
        print("⚠️ Webhook verification failed:", str(e))
        raise HTTPException(status_code=400, detail=f"Invalid webhook: {str(e)}")

    etype = event.get("type")
    data = event.get("data", {}).get("object", {})

    print(f"📬 Received Stripe event: {etype}")

    # === Handle checkout completion ===
    if etype == "checkout.session.completed":
        customer_id = data.get("customer")
        email = (
            (data.get("customer_details") or {}).get("email")
            or data.get("customer_email")
        )

        if email and customer_id:
            save_customer_id_for_user(email, customer_id)
            print(f"✅ Stored Stripe customer {customer_id} for {email}")
        else:
            print("⚠️ Missing email or customer_id in checkout.session.completed")

    # === Handle subscription lifecycle (optional for now) ===
    elif etype in [
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ]:
        print(f"ℹ️ Subscription event: {etype}")

    return JSONResponse(status_code=200, content={"ok": True})


# --- Optional sanity check route ---
@router.get("/webhook")
async def webhook_check():
    return JSONResponse(status_code=200, content={"message": "Stripe webhook alive"})
