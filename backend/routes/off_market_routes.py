import logging
import os

from fastapi import APIRouter, HTTPException
from openai import OpenAI
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class OffMarketRequest(BaseModel):
    location: str
    budget: float
    count: int = 5


@router.post("/generate-off-market")
async def generate_off_market(payload: OffMarketRequest):
    """
    Generate off-market property deals using OpenAI.
    """
    prompt = (
        f"Generate {payload.count} unique off-market property investment opportunities "
        f"in {payload.location} under a budget of £{payload.budget:.2f}. "
        "Provide each opportunity as a JSON object with keys: address, price, description. "
        "Return a JSON array of these objects."
    )
    try:
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
        content = response.choices[0].message.content.strip()
        return {"deals": content}

    except Exception as e:  # ✅ properly aligned with try
        logger.exception("Failed to generate off-market deals")
        raise HTTPException(
            status_code=500, detail="Failed to generate off-market deals"
        )
