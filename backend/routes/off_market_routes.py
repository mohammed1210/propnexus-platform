import json
import logging
import os
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from openai import OpenAI
from pydantic import BaseModel, Field, ValidationError, field_validator

router = APIRouter(prefix="/off-market", tags=["off-market"])
logger = logging.getLogger(__name__)

# The OpenAI client will read OPENAI_API_KEY from the environment if not passed explicitly.
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class OffMarketRequest(BaseModel):
    location: str = Field(..., min_length=2)
    budget: float = Field(..., gt=0)
    count: int = Field(5, ge=1, le=20)

    @field_validator("location")
    @classmethod
    def strip_location(cls, v: str) -> str:
        return v.strip()


class GeneratedDeal(BaseModel):
    address: str
    price: float
    description: str
    # Optional extra fields if models include them
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None


def _build_prompt(payload: OffMarketRequest) -> str:
    return (
        "You are a property investment analyst. "
        f"Generate {payload.count} unique OFF-MARKET residential property investment opportunities "
        f"in {payload.location} with asking prices strictly under £{payload.budget:,.0f}. "
        "Respond ONLY with a valid JSON array. Each element must be a JSON object with keys: "
        '"address" (string), "price" (number), "description" (string). '
        "Do not include any extra commentary or Markdown fences."
    )


def _coerce_json_array(raw: str) -> List[dict]:
    """
    Try hard to coerce the model response into a JSON list.
    Strips code fences if present and validates the shape.
    """
    s = raw.strip()

    # Remove common Markdown code fences
    if s.startswith("```"):
        s = s.strip("`")
        # After stripping backticks, there may still be a language token like json\n
        if "\n" in s:
            s = s.split("\n", 1)[1]

    # Parse JSON
    data = json.loads(s)

    if not isinstance(data, list):
        raise ValueError("Expected a JSON array.")

    return data


@router.post("/generate-off-market")
async def generate_off_market(payload: OffMarketRequest):
    """
    Generate off-market property deals via OpenAI and return a validated JSON array.
    """
    prompt = _build_prompt(payload)

    try:
        # Use Chat Completions for backwards compatibility with your stack.
        # If you migrate later, switch to `client.responses.create(...)`.
        resp = openai_client.chat.completions.create(
            model="gpt-4o-mini",  # smaller/faster; change if you prefer
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
        )

        content = (resp.choices[0].message.content or "").strip()
        deals_raw = _coerce_json_array(content)

        # Validate each deal object
        deals: List[GeneratedDeal] = []
        for item in deals_raw:
            try:
                deals.append(GeneratedDeal.model_validate(item))
            except ValidationError as ve:
                logger.warning("Invalid deal item skipped: %s", ve)
                continue

        # Enforce count and budget cap just in case
        filtered: List[dict] = [
            d.model_dump()
            for d in deals
            if d.price is not None and d.price < payload.budget
        ][: payload.count]

        if not filtered:
            raise HTTPException(
                status_code=502,
                detail="Model returned no valid deals. Try again or adjust parameters.",
            )

        return {"deals": filtered}

    except HTTPException:
        raise
    except json.JSONDecodeError:
        logger.exception("Model did not return valid JSON.")
        raise HTTPException(
            status_code=502, detail="Model did not return valid JSON array."
        )
    except Exception:
        logger.exception("Failed to generate off-market deals.")
        raise HTTPException(
            status_code=500, detail="Failed to generate off-market deals."
        )
