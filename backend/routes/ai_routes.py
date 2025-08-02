from fastapi import APIRouter, Request
from pydantic import BaseModel
from openai import OpenAI
import os

router = APIRouter()
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class PropertySummaryRequest(BaseModel):
    property: dict

class StrategyRequest(BaseModel):
    price: float
    roi_percent: float
    yield_percent: float
    location: str
    property_type: str = ""
    description: str = ""

@router.post("/generate-summary")
async def generate_summary(payload: PropertySummaryRequest):
    prop = payload.property
    try:
        prompt = f"""
Summarise this UK property investment in 2–3 sentences:
- Title: {prop.get("title")}
- Location: {prop.get("location")}
- Price: £{prop.get("price")}
- Yield: {prop.get("yield_percent")}%
- ROI: {prop.get("roi_percent")}%
- Bedrooms: {prop.get("bedrooms")}
- Bathrooms: {prop.get("bathrooms")}
- Investment Type: {prop.get("investmentType")}
- Property Type: {prop.get("propertyType")}
        """

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert UK property investment advisor. Summarize deals briefly for investors.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=150,
        )

        summary = response.choices[0].message.content.strip()
        return {"summary": summary}

    except Exception as e:
        print("❌ GPT summary error:", str(e))
        return {"summary": "Unable to generate summary."}

@router.post("/generate-strategies")
async def generate_strategies(payload: StrategyRequest):
    try:
        prompt = f"""
You are a UK property strategist. Suggest 3 smart exit strategies for this deal:

- Price: £{payload.price}
- ROI: {payload.roi_percent}%
- Yield: {payload.yield_percent}%
- Location: {payload.location}
- Property Type: {payload.property_type}
- Description: {payload.description or 'N/A'}

Use bullet points and short, clear wording.
        """

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=300,
        )

        content = response.choices[0].message.content
        strategies = [
            line.strip()
            for line in content.split("\n")
            if line.strip().startswith("-") or line.strip().startswith("•") or line.strip().startswith("1.")
        ]

        return {"strategies": strategies}

    except Exception as e:
        print("❌ GPT strategy error:", str(e))
        return {"strategies": ["Unable to generate strategies."]}
