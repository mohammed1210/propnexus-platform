# backend/routes/stripe_routes.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os

try:
    import stripe  # type: ignore
except Exception:
    stripe = None

router = APIRouter(prefix="/billing", tags=["billing"])

class CheckoutReq(BaseModel):
    plan: str = "premium"

@router.post("/create-checkout-session")
def create_checkout_session(body: CheckoutReq):
    if stripe is None:
        raise HTTPException(status_code=501, detail="Stripe SDK not installed on server")

    secret = os.getenv("STRIPE_API_KEY")
    price_premium = os.getenv("STRIPE_PRICE_PREMIUM")
    frontend = os.getenv("FRONTEND_URL", "http://localhost:3000")

    if not secret or not price_premium:
        raise HTTPException(status_code=500, detail="Missing STRIPE_API_KEY or STRIPE_PRICE_PREMIUM")

    stripe.api_key = secret
    price_id = price_premium if body.plan == "premium" else price_premium

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{frontend}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{frontend}/billing/cancelled",
            allow_promotion_codes=True,
            metadata={"plan": body.plan},
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))