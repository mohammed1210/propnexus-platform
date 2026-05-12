import os

from fastapi import APIRouter, HTTPException, Response

from backend.services import ai_service
from backend.utils.deal_scoring import compute_deal_score

router = APIRouter(prefix="/gpt", tags=["GPT AI"])


_CANONICAL_HEADERS = {"X-PropNexus-AI-API": "canonical"}


def _apply_canonical_headers(response: Response) -> None:
    response.headers.update(_CANONICAL_HEADERS)


def _raise_with_canonical_headers(exc: HTTPException) -> None:
    headers = dict(exc.headers or {})
    headers.update(_CANONICAL_HEADERS)
    raise HTTPException(status_code=exc.status_code, detail=exc.detail, headers=headers)


@router.post("/generate-summary")
async def generate_summary(data: dict, response: Response):
    _apply_canonical_headers(response)
    """Generate a concise investment summary for a property."""
    prompt = f"Summarize this property for investors: {data.get('description', '')}"
    try:
        text = await ai_service.chat_messages(
            [{"role": "user", "content": prompt}],
        )
        return {"summary": text}
    except HTTPException as exc:
        _raise_with_canonical_headers(exc)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating summary: {str(e)}",
            headers=_CANONICAL_HEADERS,
        )


@router.post("/generate-strategies")
async def generate_strategies(data: dict, response: Response):
    _apply_canonical_headers(response)
    """Generate 3 suggested exit strategies for an investment."""
    prompt = f"Suggest 3 exit strategies for this investment: {data.get('description', '')}"
    try:
        text = await ai_service.chat_messages(
            [{"role": "user", "content": prompt}],
        )
        return {"strategies": text}
    except HTTPException as exc:
        _raise_with_canonical_headers(exc)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating strategies: {str(e)}",
            headers=_CANONICAL_HEADERS,
        )


@router.get("/health")
async def gpt_health(response: Response):
    _apply_canonical_headers(response)
    """Lightweight health check for GPT routes.

    This must succeed even when OPENAI_API_KEY is missing.
    """
    enabled = bool(os.getenv("OPENAI_API_KEY"))
    return {"ok": True, "ai_enabled": enabled, "ai_disabled": not enabled}


# Sprint 11: AI Chat & Scoring Endpoints


@router.post("/chat")
async def ai_chat(data: dict, response: Response):
    _apply_canonical_headers(response)
    """
    POST /gpt/chat
    Input: {
      "messages": [{"role": "user", "content": "..."}],
      "context": {"property_id": "opt", "summary": "opt", "area_key": "opt", "postcode": "opt"}
    }
    Returns: {"ok": true, "reply": "...", "usage": {...}}
    """
    messages = data.get("messages", [])
    context = data.get("context", {})

    if not messages:
        raise HTTPException(
            status_code=400, detail="messages array required", headers=_CANONICAL_HEADERS
        )

    # Build system prompt with context if provided
    system_msg = "You are a helpful AI assistant for PropNexus, a UK property investment platform."
    if context:
        ctx_parts = []
        if context.get("property_id"):
            ctx_parts.append(f"Property ID: {context['property_id']}")
        if context.get("summary"):
            ctx_parts.append(f"Summary: {context['summary']}")
        if context.get("area_key"):
            ctx_parts.append(f"Area: {context['area_key']}")
        if context.get("postcode"):
            ctx_parts.append(f"Postcode: {context['postcode']}")
        if ctx_parts:
            system_msg += "\n\nContext:\n" + "\n".join(ctx_parts)

    full_messages = [{"role": "system", "content": system_msg}] + messages

    try:
        reply = await ai_service.chat_messages(full_messages)
        usage = {"prompt_tokens": 0, "completion_tokens": 0}
        return {"ok": True, "reply": reply, "usage": usage}
    except HTTPException as exc:
        _raise_with_canonical_headers(exc)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error in AI chat: {str(e)}", headers=_CANONICAL_HEADERS
        )


@router.post("/score")
async def ai_score(data: dict, response: Response):
    _apply_canonical_headers(response)
    """
    POST /gpt/score
    Deterministic rubric-based scoring (no GPT).
    Input: property data dict
    Returns: {"ok": true, "score": 78, "categories": {...}, "version": "v1.0"}
    """
    score, breakdown = compute_deal_score(data)
    categories = breakdown.get("categories") or {}
    version = breakdown.get("version") or "v1.0"

    return {"ok": True, "score": score, "categories": categories, "version": version}


@router.post("/score/explain")
async def ai_score_explain(data: dict, response: Response):
    _apply_canonical_headers(response)
    """
    POST /gpt/score/explain
    Uses GPT to generate 5-7 bullet points + paragraph summary explaining the deal score.
    Input: property data + score
    Returns: {"ok": true, "explanation": "...", "bullets": ["...", "..."]}
    """
    score = data.get("score", 0)
    property_info = data.get("property", {})

    # Build a prompt for GPT
    prompt = f"""You are an AI investment analyst for UK property. A property has received a deal score of {score}/100.

Property details:
- Price: £{property_info.get("price", "N/A")}
- Location: {property_info.get("location", "N/A")}
- Bedrooms: {property_info.get("bedrooms", "N/A")}
- Yield: {property_info.get("yield_percent", "N/A")}%
- ROI: {property_info.get("roi_percent", "N/A")}%

Please provide:
1. A brief paragraph summary (2-3 sentences) explaining what this score means
2. 5-7 key bullet points highlighting the main factors affecting this score

Format your response as:
SUMMARY: [your summary here]

BULLETS:
- [bullet 1]
- [bullet 2]
- [bullet 3]
...
"""

    try:
        text = await ai_service.chat_messages(
            [{"role": "user", "content": prompt}],
        )

        # Parse response
        parts = text.split("BULLETS:")
        summary = ""
        bullets = []

        if len(parts) >= 2:
            summary_part = parts[0].replace("SUMMARY:", "").strip()
            bullets_part = parts[1].strip()
            summary = summary_part
            # Extract bullet points
            for line in bullets_part.split("\n"):
                line = line.strip()
                if line.startswith("-") or line.startswith("•"):
                    bullets.append(line[1:].strip())
        else:
            # Fallback: use entire text as summary
            summary = text

        if not bullets:
            bullets = [
                "Score explanation could not be generated. Review the visible evidence-backed factors before relying on the score.",
            ]
        if not summary:
            summary = "Explanation unavailable."

        return {
            "ok": True,
            "explanation": summary,
            "bullets": bullets[:7],  # max 7
        }
    except HTTPException as exc:
        _raise_with_canonical_headers(exc)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating explanation: {str(e)}",
            headers=_CANONICAL_HEADERS,
        )
