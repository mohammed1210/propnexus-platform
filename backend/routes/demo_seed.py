from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request, status

from backend.db import sb
from backend.utils.admin_auth import require_admin
from backend.utils.deal_scoring import compute_deal_score
from backend.utils.listing_keys import extract_postcode
from backend.utils.supabase_sanitize import sanitize_property_payload

router = APIRouter(prefix="/admin", tags=["admin"])


def _coerce_int(v: Any) -> int | None:
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        return int(v)
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        try:
            return int(float(s))
        except Exception:
            return None
    return None


def _coerce_float(v: Any) -> float | None:
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        try:
            return float(s)
        except Exception:
            return None
    return None


def _chunk(rows: List[Dict[str, Any]], *, size: int) -> List[List[Dict[str, Any]]]:
    out: List[List[Dict[str, Any]]] = []
    for i in range(0, len(rows), size):
        out.append(rows[i : i + size])
    return out


@router.post("/seed-demo")
def seed_demo(request: Request):
    """Seed demo properties from data/listings.sample.csv.

    Admin protected: requires X-Admin-Token / Bearer / ?admin_token.
    """

    require_admin(request)

    if not sb:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)",
        )

    csv_path = Path(__file__).resolve().parents[2] / "data" / "listings.sample.csv"
    if not csv_path.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Seed file missing: data/listings.sample.csv",
        )

    now_iso = datetime.now(timezone.utc).isoformat()

    allowed_columns = {
        "external_id",
        "source",
        "title",
        "description",
        "price",
        "bedrooms",
        "bathrooms",
        "property_type",
        "address",
        "postcode",
        "latitude",
        "longitude",
        "url",
        "image_urls",
        "data",
        "yield_percent",
        "roi_percent",
        "investment_type",
        "bmv",
        "location",
        "imageurl",
        "last_seen_at",
        "score",
        "score_updated_at",
        "score_breakdown",
    }

    rows: List[Dict[str, Any]] = []
    with csv_path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            if not isinstance(raw, dict):
                continue

            external_id = str(raw.get("external_id") or "").strip()
            title = str(raw.get("title") or "").strip()
            location = str(raw.get("location") or "").strip()

            if not external_id or not title:
                continue

            postcode = extract_postcode(location) or extract_postcode(title) or None

            payload: Dict[str, Any] = {
                "external_id": external_id,
                "source": "demo",
                "title": title,
                "location": location or postcode,
                "postcode": postcode,
                "price": _coerce_int(raw.get("price")),
                "bedrooms": _coerce_int(raw.get("bedrooms")),
                "bathrooms": _coerce_int(raw.get("bathrooms")),
                "yield_percent": _coerce_float(raw.get("yield_percent")),
                "roi_percent": _coerce_float(raw.get("roi_percent")),
                "imageurl": str(raw.get("imageurl") or "").strip() or None,
                "latitude": _coerce_float(raw.get("latitude")),
                "longitude": _coerce_float(raw.get("longitude")),
                "url": f"https://demo.propnexus.local/properties/{external_id}",
                "last_seen_at": now_iso,
            }

            try:
                score, breakdown = compute_deal_score(payload)
                payload["score"] = score
                payload["score_breakdown"] = breakdown
                payload["score_updated_at"] = now_iso
            except Exception:
                pass

            payload = sanitize_property_payload(payload, allowed_columns)
            rows.append(payload)

    if not rows:
        return {"ok": True, "seeded": 0, "source": "demo", "file": "data/listings.sample.csv"}

    seeded = 0
    for batch in _chunk(rows, size=100):
        if not batch:
            continue
        # Prefer deterministic conflict keys when present.
        try:
            sb.table("properties").upsert(batch, on_conflict="source,external_id").execute()
            seeded += len(batch)
            continue
        except Exception:
            pass

        # Fallback: let PostgREST choose PK/constraints.
        sb.table("properties").upsert(batch).execute()
        seeded += len(batch)

    return {"ok": True, "seeded": seeded, "source": "demo", "file": "data/listings.sample.csv"}
