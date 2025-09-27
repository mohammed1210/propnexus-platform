# backend/schemas/ai.py
from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class SummaryRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str
    location: str
    price: Optional[float] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None

    # canonical names are yield_ / roi; accept frontend's yield_percent / roi_percent
    yield_: Optional[float] = Field(default=None, alias="yield_percent")
    roi: Optional[float] = Field(default=None, alias="roi_percent")

    propertyType: Optional[str] = None
    investmentType: Optional[str] = None
    description: Optional[str] = None


class SummaryResponse(BaseModel):
    summary: str
    bullets: List[str] = []


class StrategiesRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    property: Dict[str, object]
    constraints: Optional[Dict[str, object]] = None


class Strategy(BaseModel):
    title: str
    rationale: Optional[str] = None
    steps: List[str] = []
    risk: Optional[str] = None


class StrategiesResponse(BaseModel):
    strategies: List[Strategy]
