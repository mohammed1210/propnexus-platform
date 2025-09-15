from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ValidationError
from openai import OpenAI
from typing import List, Any
import os
import re
import json
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize OpenAI client using API key from environment
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ---------- Models ----------

class OffMarketRequest(BaseModel):
    location: str
    budget: float
    count: int = 5

class Deal(BaseModel):
    address: str
    price: float
    description: str

class DealsResponse(BaseModel):
    deals: List[Deal]

# ---------- Helpers ----------

def _extract_json_array(text: str) -> Any:
    """
    Extract the first JSON array from an arbitrary string (handles stray prose / code fences).
    Returns Python object (list) or raises ValueError.
    """
    # Remove markdown code fences if present
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE | re.MULTILINE)

    # If it's already pure JSON array, try directly
    if cleaned.lstrip().startswith("[") and cleaned.rstrip().endswith("]"):
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

    # Otherwise, pull the first [...] block
    m = re.search(r"\[\s*{.*?}\s*\]", cleaned, flags=re.DOTALL)
    if not m:
        raise ValueError("No JSON array found in model output")
    return json.loads(m.group(0))

def _coerce_price(value: Any) -> float:
    """
    Convert price values like '£250,000' or '250k' to float.
    Falls back to 0.0 if it cannot be parsed.
    """
    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        s = value.strip().lower()

        # Replace currency symbols and commas
        s = s.replace("£", "").replace(",", "").replace("gbp", "").strip()

        # handle '250k' or '1.2m'
        if s.endswith("k"):
            try:
                return float(s[:-1]) * 1_000
            except ValueError:
                pass
        if s.endswith("m"):
            try:
                return float(s[:-1]) * 1_000_000
            except ValueError:
                pass

        try:
            return float(s)
        except ValueError:
            return 0.0

    return 0.0

def _normalize_deals(raw_list: Any) -> List[Deal]:
    if not isinstance(raw_list, list):
        raise ValueError("Top-level JSON must be an array")

    normalized: List[Deal] = []
    for i, item in enumerate(raw_list):
        if not isinstance(item, dict):
            raise ValueError(f"Item {i} is not an object")

        # Coerce fields
        address = str(item.get("address", "")).strip()
        description = str(item.get("description", "")).strip()
        price = _coerce_price(item.get("price", 0))

        try:
            normalized.append(Deal(address=address, price=price, description=description))
        except ValidationError as ve:
            raise ValueError(f"Invalid deal at index {i}: {ve}") from ve

    return normalized

# ---------- Route ----------

@router.post("/generate-off-market", response_model=DealsResponse)
async def generate_off_market(payload: OffMarketRequest):
    """
    Generate off-market property deals using OpenAI, returning validated JSON.
    """
    count = max(1, min(20, payload.count))  # reasonable guard

    system = (
        "You are a helpful assistant that outputs ONLY valid JSON, with no extra text. "
        "Return a JSON array of objects only."
    )
    user = (
        f"Generate {count} unique off-market property investment opportunities in "
        f"{payload.location} with a maximum budget of £{payload.budget:,.2f}.\n"
        "Each item MUST be a JSON object with keys exactly: "
        "`address` (string), `price` (number), `description` (string).\n"
        "Return ONLY a JSON array (no prose, no keys outside those three)."
    )

    try:
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.6,
        )

        content = response.choices[0].message.content or ""
        parsed = _extract_json_array(content)
        deals = _normalize_deals(parsed)

        return {"deals": [d.dict() for d in deals]}

    except (json.JSONDecodeError, ValueError) as parse_err:
        logger.exception("Off-market JSON parsing failed: %s", parse_err)
        raise HTTPException(status_code=502, detail="Model returned invalid JSON")

    except Exception as e:
        logger.exception("Failed to generate off-market deals")
        raise HTTPException(status_code=500, detail="Failed to generate off-market deals")
