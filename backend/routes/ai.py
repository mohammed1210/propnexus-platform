"""AI routes for summary and exit strategy generation."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status

from backend.schemas.ai import (
    StrategiesRequest,
    StrategiesResponse,
    SummaryRequest,
    SummaryResponse,
    TradesmenRecommendRequest,
    TradesmenRecommendResponse,
)
from backend.services import ai_service
from backend.utils.rate_limit import rate_limiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/health")
async def ai_health() -> dict:
    enabled = ai_service.ai_enabled()
    return {"ok": True, "ai_enabled": enabled, "ai_disabled": not enabled}


@router.post("/summary", response_model=SummaryResponse)
async def ai_summary(
    req: SummaryRequest,
    request: Request,
    _api_key: str = Depends(ai_service.require_api_key),
) -> SummaryResponse:
    # Rate limit by client IP
    ip = request.client.host or "unknown"
    if not rate_limiter.allow(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded"
        )

    try:
        return await ai_service.generate_summary(req)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        logger.exception("Summary generation failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI summary error")


@router.post("/strategies", response_model=StrategiesResponse)
async def ai_strategies(
    req: StrategiesRequest,
    request: Request,
    _api_key: str = Depends(ai_service.require_api_key),
) -> StrategiesResponse:
    ip = request.client.host or "unknown"
    if not rate_limiter.allow(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded"
        )

    try:
        return await ai_service.generate_strategies(req)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        logger.exception("Strategy generation failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI strategies error")


@router.post("/tradesmen/recommend", response_model=TradesmenRecommendResponse)
async def ai_tradesmen_recommend(
    req: TradesmenRecommendRequest,
    request: Request,
    _api_key: str = Depends(ai_service.require_api_key),
) -> TradesmenRecommendResponse:
    """
    Generate AI recommendation for tradesmen based on property details.

    Returns a summary of typical work needed and cost estimates for the property type.
    """
    ip = request.client.host or "unknown"
    if not rate_limiter.allow(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded"
        )

    try:
        return await ai_service.recommend_tradesmen(req)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        logger.exception("Tradesmen recommendation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="AI tradesmen recommendation error"
        )
