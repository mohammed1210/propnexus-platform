# /backend/routes/gpt_routes.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ✅ Summary schema
class SummaryRequest(BaseModel):
    title: str
    location: str
    price: float
    yield_percent: float
    roi_percent: float
    investmentType: str | None = None
    propertyType: str | None = None

@router.post("/generate-summary")
async def generate_summary(req: SummaryRequest):
    try:
        prompt = (
            f"Summarise this UK investment deal for a property investor in 1–2 sentences:\n"
            f"Title: {req.title}\n"
            f"Location: {req.location}\n"
            f"Price: £{req.price}\n"
            f"Yield: {req.yield_percent}%\n"
            f"ROI: {req.roi_percent}%\n"
            f"Strategy: {req.investmentType or 'N/A'}\n"
            f"Property Type: {req.propertyType or 'N/A'}"
        )

        chat = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an investment analyst summarizing UK property deals."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=100,
        )

        return {"summary": chat.choices[0].message.content.strip()}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ✅ Strategy schema
class StrategyRequest(BaseModel):
    price: float
    roi_percent: float
    yield_percent: float
    location: str
    property_type: str | None = None
    description: str | None = None

@router.post("/generate-strategies")
async def generate_strategies(req: StrategyRequest):
    try:
        prompt = (
            f"Based on the following investment property details, suggest 3 smart exit strategies for a UK property investor:\n"
            f"- Price: £{req.price}\n"
            f"- ROI: {req.roi_percent}%\n"
            f"- Yield: {req.yield_percent}%\n"
            f"- Location: {req.location}\n"
            f"- Property Type: {req.property_type or 'Not specified'}\n"
            f"- Description: {req.description or 'Not available'}\n\n"
            f"List the strategies in bullet points with 1-sentence explanations."
        )

        chat = openai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=300,
        )

        content = chat.choices[0].message.content or "Unable to generate strategies."
        strategies = [
            line.strip()
            for line in content.split("\n")
            if line.strip().startswith("-") or line.strip().startswith("1.")
        ]

        return {"strategies": strategies}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ✅ Investment summary freeform prompt
class InvestmentPrompt(BaseModel):
    prompt: str

@router.post("/investment-summary")
async def investment_summary(req: InvestmentPrompt):
    try:
        if not req.prompt:
            raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

        chat = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert UK property investment analyst."},
                {"role": "user", "content": req.prompt},
            ],
            temperature=0.7,
            max_tokens=150,
        )

        return {"summary": chat.choices[0].message.content.strip()}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
