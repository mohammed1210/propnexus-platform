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
