from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SummaryRequest(BaseModel):
    """Request payload for generating an investment summary."""

    title: str
    price: Optional[float] = None
    location: str
    yield_: Optional[float] = Field(default=None, alias="yield")
    roi: Optional[float] = None
    description: Optional[str] = None


class SummaryResponse(BaseModel):
    """Response payload containing a summary and bullet points."""

    summary: str
    bullets: List[str]


class StrategiesRequest(BaseModel):
    """Request payload for generating exit strategies."""

    property: Dict[str, Any]
    constraints: Optional[Dict[str, Any]] = None


class Strategy(BaseModel):
    """A single exit strategy with rationale, steps, and optional risk."""

    title: str
    rationale: str
    steps: List[str]
    risk: Optional[str] = None


class StrategiesResponse(BaseModel):
    """Response payload containing a list of strategies."""

    strategies: List[Strategy]


class TradesmenRecommendRequest(BaseModel):
    """Request payload for AI tradesmen recommendations."""

    property_details: Optional[str] = None
    location: str
    property_type: Optional[str] = None
    bedrooms: Optional[int] = None
    trade_type: Optional[str] = None


class TradesmenRecommendResponse(BaseModel):
    """Response payload containing AI recommendation for tradesmen."""

    recommendation: str
    property_summary: str
