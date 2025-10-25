from fastapi import APIRouter, Request, HTTPException
import stripe, os, supabase

router = APIRouter()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
SUPA = supabase.create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, secret)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if event["type"] == "checkout.session.completed":
        email = event["data"]["object"]["customer_details"]["email"]
        SUPA.table("users").update({"tier":"pro"}).eq("email", email).execute()

    if event["type"] in ["customer.subscription.deleted","invoice.payment_failed"]:
        email = event["data"]["object"]["customer_email"]
        SUPA.table("users").update({"tier":"free"}).eq("email", email).execute()

    return {"ok": True}
