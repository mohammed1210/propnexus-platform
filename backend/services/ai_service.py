# backend/services/ai_service.py
"""Shared AI service helpers for /ai routes (canonical)."""

from __future__ import annotations

import os
from typing import Any, Dict, List

from fastapi import HTTPException, status

from backend.schemas.ai import (
    StrategiesRequest,
    StrategiesResponse,
    Strategy,
    SummaryRequest,
    SummaryResponse,
    TradesmenRecommendRequest,
    TradesmenRecommendResponse,
)
from backend.utils.openai_client import openai_client


def ai_enabled() -> bool:
    return bool(os.getenv("OPENAI_API_KEY"))


def require_api_key() -> str:
    """Ensure OPENAI_API_KEY is present; otherwise raise 503 (same payload as before)."""
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "ok": False,
                "ai_disabled": True,
                "error": "OpenAI API key not configured in environment.",
            },
        )
    return key


def format_summary_prompt(req: SummaryRequest) -> List[Dict[str, str]]:
    strategy = (
        (req.strategy_fit or req.investment_type or "unconfirmed").strip()
        if isinstance(req.strategy_fit or req.investment_type, str)
        else "unconfirmed"
    )
    sys_prompt = (
        "You are an investment analyst for UK property investors. "
        "Be concise and factual. Currency GBP. Use UK property terms. "
        "Be strategy-aware: if the strategy is Flip, Value-add, Auction, Hybrid/BRR, Development or uncertain, do not describe it as buy-to-let unless BTL evidence is explicitly provided. "
        "For BTL, focus on rent and yield; for Flip/Value-add, focus on works, resale comps and condition risk; for Auction, mention legal pack, speed and finance timing only as checks. "
        "Return plain text only."
    )
    user_prompt = (
        f"Title: {req.title}\n"
        f"Location: {req.location}\n"
        f"Price: {req.price or 'N/A'}\n"
        f"Bedrooms: {req.bedrooms or 'N/A'}\n"
        f"Bathrooms: {req.bathrooms or 'N/A'}\n"
        f"Property type: {req.property_type or 'N/A'}\n"
        f"Investment type / strategy: {strategy}\n"
        f"Yield: {req.yield_ or req.yield_percent or 'N/A'}\n"
        f"ROI: {req.roi or req.roi_percent or 'N/A'}\n"
        f"Description: {req.description or 'N/A'}\n\n"
        "Write the response in this exact format:\n"
        "1) First line: a single sentence investment summary (no label).\n"
        "2) Next lines: 3-6 bullets, each on its own line, each starting with '- '.\n\n"
        "Rules:\n"
        "- Use only the provided facts; if something is missing, say it's unknown.\n"
        "- Mention yield/ROI only if given.\n"
        "- Do not invent crime, schools, demand, BMV or rent evidence.\n"
        "- Avoid disclaimers and avoid speculation."
    )
    return [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": user_prompt},
    ]


def parse_summary_response(text: str) -> SummaryResponse:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return SummaryResponse(summary="No summary available.", bullets=[])

    summary = lines[0]
    bullets: List[str] = []
    for line in lines[1:]:
        clean = line.lstrip("-•0123456789. ").strip()
        if clean:
            bullets.append(clean)
    return SummaryResponse(summary=summary, bullets=bullets)


def _strategy_text(property_data: Dict[str, Any]) -> str:
    for key in ("strategyFit", "strategy_fit", "investmentType", "investment_type"):
        value = property_data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    property_type = property_data.get("propertyType") or property_data.get("property_type")
    if isinstance(property_type, str) and property_type.strip():
        text = property_type.strip().lower()
        if any(token in text for token in ("hmo", "multi let", "buy to let", "btl")):
            return property_type.strip()

    description = property_data.get("description")
    if isinstance(description, str) and description.strip():
        text = description.lower()
        if any(token in text for token in ("auction", "guide price", "legal pack")):
            return "auction"
        if any(
            token in text
            for token in ("refurb", "modernisation", "modernization", "value add", "works")
        ):
            return "value-add"
        if any(token in text for token in ("flip", "resale", "sell on")):
            return "flip"
        if any(token in text for token in ("brr", "refinance", "remortgage")):
            return "BRR/refinance"
        if any(token in text for token in ("development", "planning", "conversion", "land")):
            return "development"

    return "unknown/mixed"


def _strategy_guidance(strategy: str) -> str:
    text = strategy.lower()
    if any(token in text for token in ("auction", "guide price", "legal pack")):
        return "Auction route: focus on legal pack review, completion speed, funding timing, fees and compressed due diligence."
    if any(token in text for token in ("brr", "brrr", "refinance", "remortgage")):
        return "BRR/refinance route: focus on post-works value, achievable rent, refinance risk, lender assumptions and capital left in."
    if any(token in text for token in ("develop", "planning", "conversion", "land")):
        return "Development route: focus on planning status, use class, capex, delivery risk and exit liquidity."
    if any(token in text for token in ("flip", "value", "refurb", "modernis", "works", "resale")):
        return "Flip/value-add route: focus on works budget, condition risk, resale comps, programme risk and margin discipline."
    if any(
        token in text
        for token in ("btl", "buy-to-let", "buy to let", "rental", "rent", "hmo", "hold")
    ):
        return "BTL/income route: focus on rent evidence, voids, lender stress, income durability, compliance and management costs."
    return "Unknown or mixed route: use neutral investment-route language, avoid overcommitting, and make validation steps evidence-led."


def format_strategies_prompt(req: StrategiesRequest) -> List[Dict[str, str]]:
    strategy = _strategy_text(req.property)
    guidance = _strategy_guidance(strategy)
    sys_prompt = (
        "You are an investment analyst for UK property investors. "
        "Provide exit strategies with rationale, steps and risk. Currency GBP. Use UK property terms. "
        "Be strategy-aware and evidence-safe: do not force buy-to-let framing unless the inputs support an income-led route. "
        f"Strategy frame: {strategy}. {guidance} "
        "Return plain text only."
    )
    prop_lines = "\n".join(f"{k}: {v}" for k, v in req.property.items())
    constraints = req.constraints or {}
    constraint_lines = (
        "\n" + "\n".join(f"{k}: {v}" for k, v in constraints.items()) if constraints else ""
    )
    user_prompt = (
        f"Property details:\n{prop_lines}{constraint_lines}\n\n"
        "Suggest up to 3 realistic exit strategies. Use this exact template for each strategy:\n\n"
        "1. <Title>\n"
        "Rationale: <1-2 sentences, factual>\n"
        "- <Step 1>\n"
        "- <Step 2>\n"
        "- <Step 3>\n"
        "Risk: <single sentence>\n\n"
        "Rules:\n"
        "- Keep steps action-oriented and specific to UK property investing.\n"
        "- Match the route to the provided strategy context; if the strategy is uncertain, say what must be validated before choosing an exit.\n"
        "- Do not invent rent, resale, planning, legal pack, crime, schools or demand evidence.\n"
        "- If constraints are provided, respect them.\n"
        "- Avoid marketing tone and avoid speculation."
    )
    return [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": user_prompt},
    ]


def parse_strategies_response(text: str) -> StrategiesResponse:
    lines = [line.strip() for line in text.splitlines()]
    strategies: List[Strategy] = []
    current: Dict[str, List[str] | str] = {
        "title": "",
        "rationale": "",
        "steps": [],
        "risk": "",
    }

    for line in lines:
        if not line:
            continue

        if line[0].isdigit() and "." in line:
            if current["title"]:
                strategies.append(
                    Strategy(
                        title=str(current["title"]),
                        rationale=str(current["rationale"]),
                        steps=list(current["steps"]),  # type: ignore[arg-type]
                        risk=str(current["risk"]) or None,
                    )
                )
                current = {"title": "", "rationale": "", "steps": [], "risk": ""}
            current["title"] = line.split(".", 1)[1].strip()

        elif line.lower().startswith(("rationale:", "reason:")):
            current["rationale"] = line.split(":", 1)[1].strip()

        elif line.lower().startswith("risk:"):
            current["risk"] = line.split(":", 1)[1].strip()

        elif line[0] in ("-", "•") or (
            len(line) >= 3 and line[:2].isdigit() and line[2] in (".", ")")
        ):
            step = line.lstrip("-•0123456789. )").strip()
            if step:
                (current["steps"]).append(step)  # type: ignore[union-attr]

    if current["title"]:
        strategies.append(
            Strategy(
                title=str(current["title"]),
                rationale=str(current["rationale"]),
                steps=list(current["steps"]),  # type: ignore[arg-type]
                risk=str(current["risk"]) or None,
            )
        )

    if not strategies:
        strategies.append(
            Strategy(title="General Exit Strategy", rationale=text, steps=[], risk=None)
        )

    return StrategiesResponse(strategies=strategies)


def build_tradesmen_prompt(req: TradesmenRecommendRequest) -> tuple[str, str, List[Dict[str, str]]]:
    sys_prompt = (
        "You are a UK property renovation expert. "
        "Provide concise, practical advice about typical renovation work and costs. "
        "Use UK terminology and GBP pricing. Keep responses under 150 words."
    )

    property_desc = (
        f"{req.bedrooms}-bed {req.property_type or 'property'} in {req.location}"
        if req.bedrooms
        else f"{req.property_type or 'Property'} in {req.location}"
    )

    user_prompt = (
        f"For a {property_desc}, typical investors need {req.trade_type or 'various trades'}. "
        f"What are the most common renovation projects and estimated costs (ranges)? "
        f"Keep it brief and practical."
    )

    if req.property_details:
        user_prompt = f"{req.property_details}\n\n{user_prompt}"

    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": user_prompt},
    ]
    return property_desc, user_prompt, messages


async def generate_summary(req: SummaryRequest) -> SummaryResponse:
    require_api_key()
    messages = format_summary_prompt(req)
    raw = await openai_client.chat_completion(messages, temperature=0.3)
    return parse_summary_response(raw)


async def generate_strategies(req: StrategiesRequest) -> StrategiesResponse:
    require_api_key()
    messages = format_strategies_prompt(req)
    raw = await openai_client.chat_completion(messages, temperature=0.5)
    return parse_strategies_response(raw)


async def recommend_tradesmen(req: TradesmenRecommendRequest) -> TradesmenRecommendResponse:
    require_api_key()
    property_desc, _user_prompt, messages = build_tradesmen_prompt(req)
    raw = await openai_client.chat_completion(messages, temperature=0.4)
    return TradesmenRecommendResponse(
        recommendation=raw.strip(),
        property_summary=property_desc,
    )


async def chat_messages(
    messages: List[Dict[str, str]], temperature: float = 0.3, max_tokens: int = 800
) -> str:
    """Generic chat completion for /gpt/chat. Expects already-built messages."""
    require_api_key()
    return await openai_client.chat_completion(
        messages, temperature=temperature, max_tokens=max_tokens
    )
