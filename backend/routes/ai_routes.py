# backend/routes/ai_routes.py
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter

# OpenAI SDK v1+
from openai import OpenAI
from pydantic import BaseModel, Field

router = APIRouter(prefix="/ai", tags=["ai"])
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ---------- Models ----------


# (A) “Flat” payload the frontend now sends (InvestmentSummary.tsx)
class SummaryRequest(BaseModel):
    title: str = ""
    location: str = ""
    price: Optional[float] = None
    bedrooms: Optional[float] = None
    bathrooms: Optional[float] = None
    yield_percent: Optional[float] = Field(default=None, alias="yield_percent")
    roi_percent: Optional[float] = Field(default=None, alias="roi_percent")
    propertyType: Optional[str] = None
    investmentType: Optional[str] = None
    description: Optional[str] = None


# (B) Backward-compat shim for the older `{ property: {...} }` shape
class PropertySummaryRequest(BaseModel):
    property: Dict[str, Any]


class StrategyRequest(BaseModel):
    price: Optional[float] = None
    roi_percent: Optional[float] = None
    yield_percent: Optional[float] = None
    location: str = ""
    property_type: str = ""
    description: str = ""


# ---------- Helpers ----------


def _coerce_to_summary(req: SummaryRequest | PropertySummaryRequest) -> SummaryRequest:
    """Accept either shape and normalize to SummaryRequest."""
    if isinstance(req, SummaryRequest):
        return req

    # Old shape: PropertySummaryRequest
    p = req.property or {}
    return SummaryRequest(
        title=str(p.get("title") or ""),
        location=str(p.get("location") or ""),
        price=p.get("price"),
        bedrooms=p.get("bedrooms"),
        bathrooms=p.get("bathrooms"),
        yield_percent=p.get("yield_percent"),
        roi_percent=p.get("roi_percent"),
        propertyType=p.get("propertyType"),
        investmentType=p.get("investmentType"),
        description=p.get("description"),
    )


def _build_summary_prompt(p: SummaryRequest) -> str:
    return (
        "Summarise this UK property investment in 2–3 sentences for an investor. "
        "Be factual and concise. Then provide 3 short bullet points for key checks.\n\n"
        f"- Title: {p.title or 'N/A'}\n"
        f"- Location: {p.location or 'N/A'}\n"
        f"- Price: £{p.price if p.price is not None else 'N/A'}\n"
        f"- Yield: {p.yield_percent if p.yield_percent is not None else 'N/A'}%\n"
        f"- ROI: {p.roi_percent if p.roi_percent is not None else 'N/A'}%\n"
        f"- Bedrooms: {p.bedrooms if p.bedrooms is not None else 'N/A'}\n"
        f"- Bathrooms: {p.bathrooms if p.bathrooms is not None else 'N/A'}\n"
        f"- Investment Type: {p.investmentType or 'N/A'}\n"
        f"- Property Type: {p.propertyType or 'N/A'}\n"
        f"- Notes: {p.description or 'N/A'}\n\n"
        "Output format:\n"
        "SUMMARY:\n"
        "<2–3 sentences>\n"
        "BULLETS:\n"
        "- <item 1>\n- <item 2>\n- <item 3>"
    )


def _parse_summary(text: str) -> Dict[str, Any]:
    summary = ""
    bullets: List[str] = []

    # very small parser for our structured output
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    mode: Optional[str] = None
    for ln in lines:
        if ln.upper().startswith("SUMMARY"):
            mode = "summary"
            continue
        if ln.upper().startswith("BULLETS"):
            mode = "bullets"
            continue

        if mode == "summary":
            summary += ln + " "
        elif mode == "bullets":
            if ln.startswith(("-", "•", "1.", "2.", "3.")):
                bullets.append(ln.lstrip("-•0123. ").strip())

    return {
        "summary": summary.strip() or text.strip(),
        "bullets": bullets[:3],
    }


# ---------- Routes ----------


@router.post("/summary")  # new canonical path used by frontend postAiSummary
@router.post("/generate-summary")  # legacy path kept for safety
async def generate_summary(payload: SummaryRequest | PropertySummaryRequest):
    try:
        req = _coerce_to_summary(payload)
        prompt = _build_summary_prompt(req)

        resp = client.chat.completions.create(
            model="gpt-4o-mini",  # fast/cheap, adjust if you prefer gpt-4o
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert UK property investment analyst. "
                        "Keep outputs concise, practical, and non-promissory."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            max_tokens=350,
        )

        content = resp.choices[0].message.content or ""
        return _parse_summary(content)

    except Exception as e:
        # keep API stable: never 500 the widget
        print("❌ GPT summary error:", repr(e))
        return {
            "summary": "Indicative view: provide price, yield/ROI, and brief description for a sharper analysis.",
            "bullets": [
                "Sense-check refurb scope and contingency.",
                "Pressure-test rent vs. local comps & voids.",
                "Model refinance/exit options (BRRR vs. sale).",
            ],
        }


@router.post("/generate-strategies")
async def generate_strategies(payload: StrategyRequest):
    try:
        prompt = (
            "You are a UK property strategist. Suggest 3 smart exit strategies for this deal. "
            "Use short, actionable bullets.\n\n"
            f"- Price: £{payload.price if payload.price is not None else 'N/A'}\n"
            f"- ROI: {payload.roi_percent if payload.roi_percent is not None else 'N/A'}%\n"
            f"- Yield: {payload.yield_percent if payload.yield_percent is not None else 'N/A'}%\n"
            f"- Location: {payload.location or 'N/A'}\n"
            f"- Property Type: {payload.property_type or 'N/A'}\n"
            f"- Notes: {payload.description or 'N/A'}\n"
        )

        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            max_tokens=300,
        )
        text = (resp.choices[0].message.content or "").strip()
        bullets = [
            ln.lstrip("-•0123456789. ").strip()
            for ln in text.splitlines()
            if ln.strip().startswith(("-", "•", "1.", "2.", "3."))
        ]
        return {
            "strategies": bullets[:3]
            or ["Hold & refinance (BRRR).", "Flip at GDV.", "Let as standard BTL."]
        }

    except Exception as e:
        print("❌ GPT strategy error:", repr(e))
        return {"strategies": ["Unable to generate strategies right now. Try again."]}
