# backend/routes/ai.py
"""AI routes for summary and exit strategy generation (PO2)."""

from __future__ import annotations

import logging
import os
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request, status

# ✅ Package-relative imports so it works locally and on Railway
from ..schemas.ai import (
    StrategiesRequest,
    StrategiesResponse,
    Strategy,
    SummaryRequest,
    SummaryResponse,
)
from ..utils.openai_client import openai_client
from ..utils.rate_limit import rate_limiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"])


def ensure_api_key() -> str:
    """Ensure OPENAI_API_KEY is present; otherwise raise 503."""
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service not configured: set OPENAI_API_KEY",
        )
    return key


# --------------------------- Prompt builders --------------------------------- #
def format_summary_prompt(req: SummaryRequest) -> List[Dict[str, str]]:
    sys_prompt = (
        "You are an investment analyst for UK buy-to-let properties. "
        "Be concise and factual. Use GBP and UK property terminology."
    )
    user_prompt = (
        f"Title: {req.title}\n"
        f"Location: {req.location}\n"
        f"Price: {req.price or 'N/A'}\n"
        f"Bedrooms: {req.bedrooms or 'N/A'}\n"
        f"Bathrooms: {req.bathrooms or 'N/A'}\n"
        f"Yield %: {req.yield_percent or 'N/A'}\n"
        f"ROI %: {req.roi_percent or 'N/A'}\n"
        f"Property type: {req.propertyType or 'N/A'}\n"
        f"Investment type: {req.investmentType or 'N/A'}\n"
        f"Description: {req.description or 'N/A'}\n\n"
        "Provide a short 1–2 sentence summary.\n"
        "Then list 4–6 bullet points of key investment factors."
    )
    return [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": user_prompt},
    ]


def format_strategies_prompt(req: StrategiesRequest) -> List[Dict[str, str]]:
    sys_prompt = (
        "You are an investment analyst for UK buy-to-let properties. "
        "Return exit strategies with rationale, steps and risk. Use GBP."
    )
    prop_lines = "\n".join(f"{k}: {v}" for k, v in req.property.items())
    constraints = req.constraints or {}
    constraint_lines = (
        "\n" + "\n".join(f"{k}: {v}" for k, v in constraints.items())
        if constraints
        else ""
    )
    user_prompt = (
        f"Property details:\n{prop_lines}{constraint_lines}\n\n"
        "Suggest up to 3 exit strategies. For each strategy, provide a title, "
        "a 'Rationale:' sentence, a numbered list of steps (3–6), and 'Risk:'."
    )
    return [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": user_prompt},
    ]


# --------------------------- Parsers ----------------------------------------- #
def parse_summary_response(text: str) -> SummaryResponse:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return SummaryResponse(summary="No summary available.", bullets=[])
    summary = lines[0]
    bullets: List[str] = []
    for line in lines[1:]:
        clean = line.lstrip("-•0123456789.) ").strip()
        if clean:
            bullets.append(clean)
    return SummaryResponse(summary=summary, bullets=bullets)


def parse_strategies_response(text: str) -> StrategiesResponse:
    lines = [line.rstrip() for line in text.splitlines()]
    strategies: List[Strategy] = []
    current = {"title": "", "rationale": "", "steps": [], "risk": ""}

    def flush():
        if current["title"]:
            strategies.append(
                Strategy(
                    title=current["title"],
                    rationale=current["rationale"],
                    steps=list(current["steps"]),
                    risk=current["risk"] or None,
                )
            )

    for line in lines:
        if not line.strip():
            continue
        if line[0].isdigit() and "." in line[:4]:  # "1. Title"
            flush()
            current = {
                "title": line.split(".", 1)[1].strip(),
                "rationale": "",
                "steps": [],
                "risk": "",
            }
            continue
        low = line.lower()
        if low.startswith("rationale:"):
            current["rationale"] = line.split(":", 1)[1].strip()
            continue
        if low.startswith("risk:"):
            current["risk"] = line.split(":", 1)[1].strip()
            continue
        # steps (bullets or numbered)
        if low.lstrip().startswith(("-", "•")) or (
            line[:2].isdigit() and line[2] in (".", ")")
        ):
            step = line.lstrip("-•0123456789.) ").strip()
            if step:
                current["steps"].append(step)

    flush()

    if not strategies:
        strategies.append(
            Strategy(
                title="General Exit Strategy",
                rationale=text.strip() or "N/A",
                steps=[],
                risk=None,
            )
        )
    return StrategiesResponse(strategies=strategies)


# --------------------------- Routes ------------------------------------------ #
@router.post("/summary", response_model=SummaryResponse)
async def ai_summary(
    req: SummaryRequest,
    request: Request,
    _api_key: str = Depends(ensure_api_key),
) -> SummaryResponse:
    ip = request.client.host or "unknown"
    if not rate_limiter.allow(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded"
        )
    try:
        messages = format_summary_prompt(req)
        raw = await openai_client.chat_completion(messages, temperature=0.3)
        return parse_summary_response(raw)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        )
    except Exception as exc:
        logger.exception("Summary generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="AI summary error"
        )


@router.post("/strategies", response_model=StrategiesResponse)
async def ai_strategies(
    req: StrategiesRequest,
    request: Request,
    _api_key: str = Depends(ensure_api_key),
) -> StrategiesResponse:
    ip = request.client.host or "unknown"
    if not rate_limiter.allow(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded"
        )
    try:
        messages = format_strategies_prompt(req)
        raw = await openai_client.chat_completion(messages, temperature=0.5)
        return parse_strategies_response(raw)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        )
    except Exception as exc:
        logger.exception("Strategy generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="AI strategies error"
        )
