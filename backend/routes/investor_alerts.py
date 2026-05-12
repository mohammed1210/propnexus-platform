from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from backend.utils.supabase_client import get_supabase

router = APIRouter(prefix="/investor-alerts", tags=["investor-alerts"])


def _user_id(x_clerk_user_id: Optional[str] = None) -> str:
    uid = str(x_clerk_user_id or "").strip()
    if not uid:
        raise HTTPException(status_code=401, detail="Missing user identity")
    return uid


class AlertPayload(BaseModel):
    label: str = "Deal alert"
    search_query: str = ""
    filters: Dict[str, Any] = Field(default_factory=dict)
    min_discovery_score: Optional[int] = None
    include_tiers: List[str] = Field(default_factory=lambda: ["prime", "strong"])
    frequency: str = "daily"
    active: bool = True


@router.get("")
def list_alerts(x_clerk_user_id: Optional[str] = Header(default=None)):
    uid = _user_id(x_clerk_user_id)
    sb = get_supabase()
    res = (
        sb.table("investor_alerts")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", desc=True)
        .execute()
    )
    return {"items": res.data if isinstance(res.data, list) else []}


@router.post("")
def create_alert(payload: AlertPayload, x_clerk_user_id: Optional[str] = Header(default=None)):
    uid = _user_id(x_clerk_user_id)
    sb = get_supabase()
    row = payload.model_dump()
    row["user_id"] = uid
    now = datetime.now(timezone.utc).isoformat()
    row["created_at"] = now
    row["updated_at"] = now
    res = sb.table("investor_alerts").insert(row).execute()
    data = res.data[0] if isinstance(res.data, list) and res.data else row
    return {"ok": True, "alert": data}


@router.patch("/{alert_id}")
def update_alert(
    alert_id: str, payload: Dict[str, Any], x_clerk_user_id: Optional[str] = Header(default=None)
):
    uid = _user_id(x_clerk_user_id)
    allowed = {"label", "filters", "min_discovery_score", "include_tiers", "frequency", "active"}
    patch = {k: v for k, v in payload.items() if k in allowed}
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    sb = get_supabase()
    res = sb.table("investor_alerts").update(patch).eq("id", alert_id).eq("user_id", uid).execute()
    return {"ok": True, "items": res.data if isinstance(res.data, list) else []}


@router.delete("/{alert_id}")
def delete_alert(alert_id: str, x_clerk_user_id: Optional[str] = Header(default=None)):
    uid = _user_id(x_clerk_user_id)
    sb = get_supabase()
    sb.table("investor_alerts").delete().eq("id", alert_id).eq("user_id", uid).execute()
    return {"ok": True}


@router.post("/digest-preview")
def digest_preview(x_clerk_user_id: Optional[str] = Header(default=None)):
    uid = _user_id(x_clerk_user_id)
    sb = get_supabase()
    alerts = (
        sb.table("investor_alerts").select("*").eq("user_id", uid).eq("active", True).execute().data
        or []
    )
    payloads = []
    for alert in alerts if isinstance(alerts, list) else []:
        tiers = alert.get("include_tiers") or ["prime", "strong"]
        q = (
            sb.table("properties")
            .select(
                "id,title,location,price,top_deal_score,top_deal_tier,top_deal_reasons,created_at"
            )
            .in_("top_deal_tier", tiers)
            .order("top_deal_score", desc=True)
            .limit(10)
        )
        min_score = alert.get("min_discovery_score")
        if isinstance(min_score, int):
            q = q.gte("top_deal_score", min_score)
        payloads.append({"alert": alert, "matches": q.execute().data or []})
    return {
        "ok": True,
        "delivery": "not_sent",
        "note": "Email delivery is not configured; this endpoint builds the scheduler/email payload.",
        "digests": payloads,
    }
