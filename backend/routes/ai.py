"""AI routes for summary and exit strategy generation."""
from __future__ import annotations

import logging
import os
from typing import List, Dict

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse

from ..schemas.ai import (
    SummaryRequest,
    SummaryResponse,
    StrategiesRequest,
    StrategiesResponse,
    Strategy,
)
from ..utils.rate_limit import rate_limiter
from ..utils.openai_client import openai_client

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


def format_summary_prompt(req: SummaryRequest) -> List[Dict[str, str]]:
    """Build messages for summary generation."""
    sys_prompt = (
        "You are an investment analyst for UK buy-to-let properties. "
        "Be concise and factual. Currency GBP. Use UK property terms."
    )
    user_prompt = (
        f"Title: {req.title}\n"
        f"Location: {req.location}\n"
        f"Price: {req.price or 'N/A'}\n"
        f"Yield: {req.yield_ or 'N/A'}\n"
        f"ROI: {req.roi or 'N/A'}\n"
        f"Description: {req.description or 'N/A'}\n\n"
        "Provide a short summary followed by bullet points highlighting the key investment factors."
    )
    return [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": user_prompt},
    ]


def parse_summary_response(text: str) -> SummaryResponse:
    """Split the OpenAI response into summary and bullet list."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return SummaryResponse(summary="No summary available.", bullets=[])

    summary = lines[0]
    bullets = []
    for line in lines[1:]:
        # Accept leading symbols like "-", "•", "1.", etc.
        clean = line.lstrip("-•0123456789. ").strip()
        if clean:
            bullets.append(clean)
    return SummaryResponse(summary=summary, bullets=bullets)


def format_strategies_prompt(req: StrategiesRequest) -> List[Dict[str, str]]:
    """Build messages for strategy generation."""
    sys_prompt = (
        "You are an investment analyst for UK buy-to-let properties. "
        "Provide exit strategies with rationale, steps and risk. Currency GBP. Use UK property terms."
    )
    prop_lines = "\n".join(f"{k}: {v}" for k, v in req.property.items())
    constraints = req.constraints or {}
    constraint_lines = (
        "\n" + "\n".join(f"{k}: {v}" for k, v in constraints.items()) if constraints else ""
    )
    user_prompt = (
        f"Property details:\n{prop_lines}{constraint_lines}\n\n"
        "Suggest up to 3 exit strategies. For each strategy, provide a title, rationale, a numbered list of steps, and risk."
    )
    return [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": user_prompt},
    ]


def parse_strategies_response(text: str) -> StrategiesResponse:
    """Parse OpenAI output into structured strategies."""
    lines = [line.strip() for line in text.splitlines()]
    strategies: List[Strategy] = []
    current: Dict[str, List[str] | str] = {"title": "", "rationale": "", "steps": [], "risk": ""}
    for line in lines:
        if not line:
            continue
        # New strategy starts when line looks like "1. <Title>"
        if line[0].isdigit() and "." in line:
            if current["title"]:
                strategies.append(
                    Strategy(
                        title=current["title"],
                        rationale=current["rationale"],
                        steps=list(current["steps"]),
                        risk=current["risk"] or None,
                    )
                )
                current = {"title": "", "rationale": "", "steps": [], "risk": ""}
            current["title"] = line.split(".", 1)[1].strip()
        elif line.lower().startswith(("rationale:", "reason:")):
            current["rationale"] = line.split(":", 1)[1].strip()
        elif line.lower().startswith("risk:"):
            current["risk"] = line.split(":", 1)[1].strip()
        elif line[0] in ("-", "•") or line[:2].isdigit() and line[2] in (".", ")"):
            # Step lines starting with bullet or number
            step = line.lstrip("-•0123456789. )").strip()
            current["steps"].append(step)
    # Append the last strategy
    if current["title"]:
        strategies.append(
            Strategy(
                title=current["title"],
                rationale=current["rationale"],
                steps=list(current["steps"]),
                risk=current["risk"] or None,
            )
        )
    if not strategies:
        # Fallback: put entire response as one strategy
        strategies.append(
            Strategy(title="General Exit Strategy", rationale=text, steps=[], risk=None)
        )
    return StrategiesResponse(strategies=strategies)


@router.post("/summary", response_model=SummaryResponse)
async def ai_summary(
    req: SummaryRequest,
    request: Request,
    _api_key: str = Depends(ensure_api_key),
) -> SummaryResponse:
    # Rate limit by client IP
    ip = request.client.host or "unknown"
    if not rate_limiter.allow(ip):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")

    try:
        messages = format_summary_prompt(req)
        raw = await openai_client.chat_completion(messages, temperature=0.3)
        return parse_summary_response(raw)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        logger.exception("Summary generation failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI summary error")


@router.post("/strategies", response_model=StrategiesResponse)
async def ai_strategies(
    req: StrategiesRequest,
    request: Request,
    _api_key: str = Depends(ensure_api_key),
) -> StrategiesResponse:
    ip = request.client.host or "unknown"
    if not rate_limiter.allow(ip):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")

    try:
        messages = format_strategies_prompt(req)
        raw = await openai_client.chat_completion(messages, temperature=0.5)
        return parse_strategies_response(raw)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        logger.exception("Strategy generation failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI strategies error")
        