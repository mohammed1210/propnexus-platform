import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI

router = APIRouter(prefix="/gpt")
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class SummaryRequest(BaseModel):
    title: str
    location: str
    price: float
    yield_percent: float
    roi_percent: float
    investmentType: str | None = None

@router.post("/summary")
async def generate_summary(req: SummaryRequest):
    try:
        prompt = (
            f"Summarize this property investment: {req.title} in {req.location} "
            f"priced at £{req.price:,}. Yield {req.yield_percent}%, ROI {req.roi_percent}%. "
            f"Investment type: {req.investmentType or 'general'}."
        )
        resp = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
        )
        summary = resp.choices[0].message.content.strip()
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/strategies")
async def generate_strategies(req: SummaryRequest):
    try:
        prompt = (
            f"Suggest three investment exit strategies for {req.title} in {req.location}. "
            f"Include ROI of {req.roi_percent}% and yield {req.yield_percent}%."
        )
        resp = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
        )
        text = resp.choices[0].message.content.strip()
        return {"strategies": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
