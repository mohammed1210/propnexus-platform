from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
import os, stripe
from supabase import create_client

router = APIRouter(prefix="/stripe", tags=["stripe-webhook"])

STRIPE_SECRET = os.getenv("STRIPE_SECRET_KEY")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
USERS_TABLE = os.getenv("USERS_TABLE","users")
EMAIL_COL = os.getenv("USERS_EMAIL_COL","email")
PLAN_COL = os.getenv("USERS_PLAN_COL","plan")
CUST_COL = os.getenv("USERS_STRIPE_COL","stripe_customer_id")

stripe.api_key = STRIPE_SECRET
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

def map_price_to_plan(price_id:str)->str:
    pro = os.getenv("NEXT_PUBLIC_STRIPE_PRICE_PRO")
    inv = os.getenv("NEXT_PUBLIC_STRIPE_PRICE_INVESTOR")
    if price_id == inv: return "investor"
    if price_id == pro: return "pro"
    return "free"

@router.post("/webhook")
async def stripe_webhook(req: Request):
    payload = await req.body()
    sig = req.headers.get("stripe-signature")
    if not WEBHOOK_SECRET:
        raise HTTPException(500, "WEBHOOK not configured")
    try:
        event = stripe.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(400, f"Invalid payload: {e}")

    t = event["type"]
    obj = event["data"]["object"]

    try:
        if t == "checkout.session.completed":
            customer = obj.get("customer")
            email = obj.get("customer_details",{}).get("email") or obj.get("metadata",{}).get("email")
            line_items = stripe.checkout.Session.list_line_items(obj["id"], limit=1)
            price_id = line_items.data[0].price.id if line_items.data else None
            plan = map_price_to_plan(price_id) if price_id else "pro"
            if email:
                sb.table(USERS_TABLE).upsert({EMAIL_COL: email, CUST_COL: customer, PLAN_COL: plan, "subscription_status": "active"}).execute()

        elif t in ("customer.subscription.updated","customer.subscription.created","customer.subscription.deleted"):
            customer = obj.get("customer")
            status = obj.get("status")
            cust = stripe.Customer.retrieve(customer) if customer else None
            email = cust.get("email") if cust else None
            items = obj.get("items",{}).get("data",[])
            price_id = items[0]["price"]["id"] if items else None
            plan = map_price_to_plan(price_id) if price_id else None
            update = {"subscription_status": status}
            if plan: update[PLAN_COL] = plan
            if email:
                sb.table(USERS_TABLE).upsert({EMAIL_COL: email, CUST_COL: customer, **update}).execute()
    except Exception as e:
        return JSONResponse({"received": True, "error": str(e)}, status_code=200)

    return JSONResponse({"received": True})
