import os

from fastapi import APIRouter, HTTPException
from openai import OpenAI

router = APIRouter(prefix="/gpt", tags=["GPT AI"])

# Lazy client initialization to avoid import-time errors
_client = None


def get_client() -> OpenAI:
    """Return a cached OpenAI client or initialize a new one."""
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            # Don't crash CI/import; only raise when endpoint hit
            raise HTTPException(
                status_code=503,
                detail="OpenAI API key not configured in environment.",
            )
        _client = OpenAI(api_key=api_key)
    return _client


@router.post("/generate-summary")
async def generate_summary(data: dict):
    """Generate a concise investment summary for a property."""
    prompt = f"Summarize this property for investors: {data.get('description', '')}"
    try:
        client = get_client()
        res = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )
        text = res.choices[0].message.content
        return {"summary": text}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating summary: {str(e)}")


@router.post("/generate-strategies")
async def generate_strategies(data: dict):
    """Generate 3 suggested exit strategies for an investment."""
    prompt = f"Suggest 3 exit strategies for this investment: {data.get('description', '')}"
    try:
        client = get_client()
        res = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )
        text = res.choices[0].message.content
        return {"strategies": text}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating strategies: {str(e)}")


@router.get("/health")
async def gpt_health():
    """Lightweight route to confirm GPT routes import properly."""
    return {"status": "ok", "message": "GPT routes loaded successfully"}


# Sprint 11: AI Chat & Scoring Endpoints


@router.post("/chat")
async def ai_chat(data: dict):
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
        raise HTTPException(status_code=400, detail="messages array required")

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
        client = get_client()
        res = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=full_messages,
        )
        reply = res.choices[0].message.content
        usage = {
            "prompt_tokens": res.usage.prompt_tokens if res.usage else 0,
            "completion_tokens": res.usage.completion_tokens if res.usage else 0,
        }
        return {"ok": True, "reply": reply, "usage": usage}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in AI chat: {str(e)}")


@router.post("/score")
async def ai_score(data: dict):
    """
    POST /gpt/score
    Deterministic rubric-based scoring (no GPT).
    Input: property data dict
    Returns: {"ok": true, "score": 78, "categories": {...}, "version": "v1.0"}
    """
    # Extract relevant metrics with defaults
    yield_pct = data.get("yield_percent") or data.get("rental_yield_percent") or 0
    roi_pct = data.get("roi_percent") or 0
    price = data.get("price") or 0
    rent = data.get("rent") or data.get("avg_rent") or 0

    # Use explicit None checks to preserve 0 values
    crime = data.get("crime_index")
    crime = 50 if crime is None else float(crime)

    schools = data.get("schools_rating")
    schools = 3.0 if schools is None else float(schools)

    # Calculate price-to-rent ratio (lower is better)
    price_to_rent_ratio = (price / (rent * 12)) if (rent and price) else 0

    # Category scores (out of max points each)
    # Yield: 0-20 points (5%+ yield = 20pts, linear)
    yield_score = min(20, (yield_pct / 5.0) * 20) if yield_pct > 0 else 0

    # ROI: 0-20 points (10%+ ROI = 20pts, linear)
    roi_score = min(20, (roi_pct / 10.0) * 20) if roi_pct > 0 else 0

    # Price-to-rent: 0-15 points (ratio < 15 = 15pts, inverse linear)
    ptr_score = 0
    if price_to_rent_ratio > 0:
        ptr_score = max(0, 15 - price_to_rent_ratio) if price_to_rent_ratio < 15 else 0
        ptr_score = min(15, ptr_score)

    # Area demand (proxy): 0-15 points (mock based on rent levels)
    area_score = min(15, (rent / 1500.0) * 15) if rent > 0 else 0

    # Crime index inverse: 0-15 points (crime 0-100, inverted: 100-crime gives 0-100, scale to 15)
    crime_score = ((100 - crime) / 100.0) * 15

    # Schools access: 0-15 points (rating 0-5, scale to 15)
    schools_score = (schools / 5.0) * 15

    # Total score
    total = yield_score + roi_score + ptr_score + area_score + crime_score + schools_score
    total = min(100, max(0, total))

    categories = {
        "yield": round(yield_score, 1),
        "roi": round(roi_score, 1),
        "price_to_rent": round(ptr_score, 1),
        "area_demand": round(area_score, 1),
        "crime_index_inverse": round(crime_score, 1),
        "schools_access": round(schools_score, 1),
    }

    return {
        "ok": True,
        "score": round(total, 1),
        "categories": categories,
        "version": "v1.0",
    }


@router.post("/score/explain")
async def ai_score_explain(data: dict):
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
        client = get_client()
        res = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )
        text = res.choices[0].message.content or ""

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
                "Strong rental yield indicates good cash flow potential",
                "Area demand and growth prospects are favorable",
                "Property price aligns well with market comparables",
                "Low crime rates contribute to tenant appeal",
                "Good access to schools and amenities",
            ]

        return {
            "ok": True,
            "explanation": summary,
            "bullets": bullets[:7],  # max 7
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating explanation: {str(e)}")
