from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import stripe
import os

router = APIRouter()

# Initialize Stripe with API key from environment
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")


@router.post("/create-checkout-session")
async def create_checkout_session():
    """
    Create a Stripe Checkout session for a subscription.
    Returns the session ID for client to redirect to Stripe checkout.
    """
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{"price": os.getenv("STRIPE_PRICE_ID"), "quantity": 1}],
            mode="subscription",
            success_url=os.getenv(
                "STRIPE_SUCCESS_URL", "http://localhost:3000/success"
            ),
            cancel_url=os.getenv("STRIPE_CANCEL_URL", "http://localhost:3000/cancel"),
        )
        return {"sessionId": session.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
