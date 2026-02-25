from __future__ import annotations

from fastapi import APIRouter, Request

from backend.services.providers import get_area_intel_from_provider

router = APIRouter(prefix="/area-intel", tags=["area-intel"])


@router.get("/{key}")
def get_area_intel(key: str, request: Request):
    return get_area_intel_from_provider(key)
