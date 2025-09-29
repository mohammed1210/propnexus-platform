# backend/schemas/ai.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SummaryRequest(BaseModel):
    title: str
    location: str
    price: Optional[float] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    yield_percent: Optional[float] = Field(default=None, description="Gross yield %")
    roi_percent: Optional[float] = Field(default=None, description="ROI %")
    propertyType: Optional[str] = None
    investmentType: Optional[str] = None
    description: Optional[str] = None


class SummaryResponse(BaseModel):
    summary: Optional[str] = None
    bullets: list[str] | None = None


class Strategy(BaseModel):
    title: str
    rationale: str
    steps: List[str] = []
    risk: Optional[str] = None


class StrategiesRequest(BaseModel):
    property: Dict[str, Any]
    constraints: Optional[Dict[str, Any]] = None


class StrategiesResponse(BaseModel):
    strategies: List[Strategy]
