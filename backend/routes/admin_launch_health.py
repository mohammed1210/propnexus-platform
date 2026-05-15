from __future__ import annotations

from fastapi import APIRouter, Request

from backend.scripts.launch_health_report import collect_launch_health
from backend.utils.admin_auth import require_admin

router = APIRouter(tags=["admin"])


@router.get("/admin/launch-health")
def admin_launch_health(request: Request):
    require_admin(request)
    return collect_launch_health()
