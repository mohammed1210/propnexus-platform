# backend/routes/ai.py
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from openai import OpenAI
from pydantic import BaseModel

router = APIRouter()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ---------------------------------------------------------------------
# Pydantic shapes
# We allow BOTH:
#   { property: { title, location, ... } }
# and the flat legacy:
#   { title, location, ... }
# ---------------------------------------------------------------------


class PropertyPayload(BaseModel):
    title: Optional[str] = None
    location: Optional[str] = None
    price: Optional[float] = None
    bedrooms: Optional[float] = None
    bathrooms: Optional[float] = None
    yield_percent: Optional[float] = None
    roi_percent: Optional[float] = None
    description: Optional[str] = None
    propertyType: Optional[str] = None
    investmentType: Optional[str] = None


class SummaryEnvelope(BaseModel):
    property: PropertyPayload


class StrategiesEnvelope(BaseModel):
    property: PropertyPayload


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------


def _extract_property(payload: Dict[str, Any]) -> PropertyPayload:
    """
    Accepts either:
      {"property": {...}}  OR  a flat {...}
    Returns a PropertyPayload instance.
    """
    if "property" in payload and isinstance(payload["property"], dict):
        return PropertyPayload(**payload["property"])
    return PropertyPayload(**payload)


def _split_bullets(text: str) -> List[str]:
    """Turn a free-form model response into neat bullet lines."""
    lines = [line.strip(" -•\t\r") for line in text.splitlines()]
    return [line for line in lines if line]


def _chat(
    messages: List[Dict[str, str]], max_tokens: int = 300, temperature: float = 0.7
) -> str:
    """
    Small wrapper so we can swap models easily if needed.
    """
    # Prefer a fast, inexpensive model for summaries/ideas.
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    resp = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return (resp.choices[0].message.content or "").strip()


# ---------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------


@router.post("/generate-summary")
async def generate_summary(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Returns:
      {
        "summary": "…",
        "bullets": ["…", "…"]  # optional
      }
    """
    try:
        prop = _extract_property(payload)

        prompt = (
            "Summarise this UK property investment for an investor in 2–3 sentences. "
            "Be clear, neutral and practical.\n\n"
            f"- Title: {prop.title}\n"
            f"- Location: {prop.location}\n"
            f"- Price: £{prop.price}\n"
            f"- Yield: {prop.yield_percent}%\n"
            f"- ROI: {prop.roi_percent}%\n"
            f"- Bedrooms: {prop.bedrooms}\n"
            f"- Bathrooms: {prop.bathrooms}\n"
            f"- Investment Type: {prop.investmentType}\n"
            f"- Property Type: {prop.propertyType}\n"
            f"- Notes: {prop.description}\n"
        )

        summary = _chat(
            [
                {
                    "role": "system",
                    "content": (
                        "You are an expert UK property investment analyst. "
                        "You write concise, factual summaries with no fluff."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=180,
            temperature=0.5,
        )

        # Optional: quick 3 bullet “consider” list
        bullets_raw = _chat(
            [
                {
                    "role": "system",
                    "content": "List 3 short bullet points of considerations or tips.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=120,
            temperature=0.6,
        )
        bullets = _split_bullets(bullets_raw)[:3]

        return {"summary": summary, "bullets": bullets}

    except HTTPException:
        raise
    except Exception:
        # Keep the API resilient for the UI
        return {"summary": "Unable to generate summary.", "bullets": []}


@router.post("/generate-strategies")
async def generate_strategies(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Returns:
      { "strategies": ["…", "…", "…"] }
    """
    try:
        prop = _extract_property(payload)

        prompt = (
            "You are a UK property strategist. Suggest 3 sensible exit strategies "
            "for this deal. Use one line per bullet, keep each to ~15 words.\n\n"
            f"- Price: £{prop.price}\n"
            f"- ROI: {prop.roi_percent}%   Yield: {prop.yield_percent}%\n"
            f"- Location: {prop.location}\n"
            f"- Type: {prop.propertyType or ''}  Investment: {prop.investmentType or ''}\n"
            f"- Notes: {prop.description or 'N/A'}\n"
        )

        text = _chat(
            [{"role": "user", "content": prompt}],
            max_tokens=220,
            temperature=0.7,
        )
        strategies = _split_bullets(text)[:6]  # cap just in case

        # Always return an array (frontend expects it)
        return {
            "strategies": strategies
            or [
                "Hold & rent until market improves",
                "Refurb then refinance",
                "Sell with light staging",
            ]
        }

    except HTTPException:
        raise
    except Exception:
        return {"strategies": ["Unable to generate strategies."]}
