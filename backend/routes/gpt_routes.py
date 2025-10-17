import os

from fastapi import APIRouter, HTTPException
from openai import OpenAI
from pydantic import BaseModel

router = APIRouter()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


@router.post("/generate-summary")
async def generate_summary(data: dict):
    prompt = f"Summarize this property for investors: {data.get('description')}"
    try:
        res = client.chat.completions.create(
            model="gpt-4o-mini", messages=[{"role": "user", "content": prompt}]
        )
        text = res.choices[0].message.content
        return {"summary": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-strategies")
async def generate_strategies(data: dict):
    prompt = f"Suggest 3 exit strategies for this investment: {data.get('description')}"
    try:
        res = client.chat.completions.create(
            model="gpt-4o-mini", messages=[{"role": "user", "content": prompt}]
        )
        text = res.choices[0].message.content
        return {"strategies": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
