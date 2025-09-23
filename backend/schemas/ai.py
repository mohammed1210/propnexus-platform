<<<<<<< HEAD
# backend/schemas/ai.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
=======
from typing import List, Optional
>>>>>>> 5e6940d9 (feat(ai): add schemas for summary and strategies)

from pydantic import BaseModel, Field


class SummaryRequest(BaseModel):
    title: str
<<<<<<< HEAD
    location: str
    price: Optional[float] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    yield_percent: Optional[float] = Field(default=None, description="Gross yield %")
    roi_percent: Optional[float] = Field(default=None, description="ROI %")
    propertyType: Optional[str] = None
    investmentType: Optional[str] = None
=======
    price: Optional[float] = None
    location: str
    yield_: Optional[float] = Field(default=None, alias="yield")
    roi: Optional[float] = None
>>>>>>> 5e6940d9 (feat(ai): add schemas for summary and strategies)
    description: Optional[str] = None


class SummaryResponse(BaseModel):
<<<<<<< HEAD
    summary: Optional[str] = None
    bullets: list[str] | None = None
=======
    summary: str
    bullets: List[str]


class StrategiesRequest(BaseModel):
    property: dict
    constraints: Optional[dict] = None
>>>>>>> 5e6940d9 (feat(ai): add schemas for summary and strategies)


class Strategy(BaseModel):
    title: str
    rationale: str
<<<<<<< HEAD
    steps: List[str] = []
    risk: Optional[str] = None


class StrategiesRequest(BaseModel):
    property: Dict[str, Any]
    constraints: Optional[Dict[str, Any]] = None


=======
    steps: List[str]
    risk: Optional[str] = None


>>>>>>> 5e6940d9 (feat(ai): add schemas for summary and strategies)
class StrategiesResponse(BaseModel):
    strategies: List[Strategy]
