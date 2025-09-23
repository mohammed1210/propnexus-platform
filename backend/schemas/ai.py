from typing import List, Optional

from pydantic import BaseModel, Field


class SummaryRequest(BaseModel):
    title: str
    price: Optional[float] = None
    location: str
    yield_: Optional[float] = Field(default=None, alias="yield")
    roi: Optional[float] = None
    description: Optional[str] = None


class SummaryResponse(BaseModel):
    summary: str
    bullets: List[str]


class StrategiesRequest(BaseModel):
    property: dict
    constraints: Optional[dict] = None


class Strategy(BaseModel):
    title: str
    rationale: str
    steps: List[str]
    risk: Optional[str] = None


class StrategiesResponse(BaseModel):
    strategies: List[Strategy]
