"""AI routes for summary and exit strategy generation."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from backend.middleware.rate_limit import AI_RATE_LIMIT, is_test_or_ci, limiter
from backend.schemas.ai import (
    StrategiesRequest,
    StrategiesResponse,
    SummaryRequest,
    SummaryResponse,
    TradesmenRecommendRequest,
    TradesmenRecommendResponse,
)
from backend.services import ai_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"])


_COMPAT_HEADERS = {
    "X-PropNexus-AI-API": "compat",
    "X-PropNexus-AI-Canonical": "/gpt/*",
}


def _apply_compat_headers(response: Response) -> None:
    response.headers.update(_COMPAT_HEADERS)


def _require_api_key_compat(response: Response) -> str:
    _apply_compat_headers(response)
    try:
        return ai_service.require_api_key()
    except HTTPException as exc:
        # Ensure headers are present even when dependency raises.
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.detail,
            headers=_COMPAT_HEADERS,
        )


@router.get("/health")
async def ai_health(response: Response) -> dict:
    _apply_compat_headers(response)
    enabled = ai_service.ai_enabled()
    return {"ok": True, "ai_enabled": enabled, "ai_disabled": not enabled}


@router.post("/summary", response_model=SummaryResponse)
@limiter.limit(AI_RATE_LIMIT, exempt_when=is_test_or_ci)
async def ai_summary(
    req: SummaryRequest,
    request: Request,
    response: Response,
    _api_key: str = Depends(_require_api_key_compat),
) -> SummaryResponse:
    _apply_compat_headers(response)

    try:
        return await ai_service.generate_summary(req)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
            headers=_COMPAT_HEADERS,
        )
    except Exception as exc:
        logger.exception("Summary generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI summary error",
            headers=_COMPAT_HEADERS,
        )


@router.post("/strategies", response_model=StrategiesResponse)
@limiter.limit(AI_RATE_LIMIT, exempt_when=is_test_or_ci)
async def ai_strategies(
    req: StrategiesRequest,
    request: Request,
    response: Response,
    _api_key: str = Depends(_require_api_key_compat),
) -> StrategiesResponse:
    _apply_compat_headers(response)

    try:
        return await ai_service.generate_strategies(req)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
            headers=_COMPAT_HEADERS,
        )
    except Exception as exc:
        logger.exception("Strategy generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI strategies error",
            headers=_COMPAT_HEADERS,
        )


@router.post("/tradesmen/recommend", response_model=TradesmenRecommendResponse)
@limiter.limit(AI_RATE_LIMIT, exempt_when=is_test_or_ci)
async def ai_tradesmen_recommend(
    req: TradesmenRecommendRequest,
    request: Request,
    response: Response,
    _api_key: str = Depends(_require_api_key_compat),
) -> TradesmenRecommendResponse:
    """
    Generate AI recommendation for tradesmen based on property details.

    Returns a summary of typical work needed and cost estimates for the property type.
    """
    _apply_compat_headers(response)

    try:
        return await ai_service.recommend_tradesmen(req)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
            headers=_COMPAT_HEADERS,
        )
    except Exception as exc:
        logger.exception("Tradesmen recommendation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI tradesmen recommendation error",
            headers=_COMPAT_HEADERS,
        )
