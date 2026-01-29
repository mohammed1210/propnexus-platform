from __future__ import annotations

import asyncio
import re
from typing import Any, Dict
from urllib.parse import quote

import aiohttp

try:
    from backend.db import sb  # type: ignore
except Exception:  # pragma: no cover
    sb = None


_POSTCODE_RE = re.compile(r"\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b", re.I)
_CACHE: dict[str, tuple[float, float]] = {}


def _normalize_postcode(postcode: str) -> str | None:
    if not isinstance(postcode, str):
        return None
    s = postcode.strip().upper()
    if not s:
        return None
    m = _POSTCODE_RE.search(s)
    if not m:
        return None
    # Canonical: remove spaces (DB cache key); callers can re-space if desired.
    return re.sub(r"\s+", "", m.group(0))


def _coerce_float(v: Any) -> float | None:
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        try:
            return float(v.strip())
        except Exception:
            return None
    return None


async def _fetch_postcodes_io(postcode: str) -> Dict[str, float] | None:
    url = f"https://api.postcodes.io/postcodes/{quote(postcode)}"
    timeout = aiohttp.ClientTimeout(total=6)

    for attempt in range(3):
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url, headers={"Accept": "application/json"}) as resp:
                    # Retry only on transient status codes.
                    if resp.status in (429, 500, 502, 503, 504):
                        raise aiohttp.ClientResponseError(
                            request_info=resp.request_info,
                            history=resp.history,
                            status=resp.status,
                            message="retryable",
                            headers=resp.headers,
                        )

                    data = await resp.json(content_type=None)
                    if resp.status == 200 and isinstance(data, dict) and data.get("status") == 200:
                        result = data.get("result")
                        if isinstance(result, dict):
                            lat = _coerce_float(result.get("latitude"))
                            lng = _coerce_float(result.get("longitude"))
                            if lat is not None and lng is not None:
                                return {"latitude": lat, "longitude": lng}
                    return None
        except aiohttp.ClientResponseError as e:
            if e.status not in (429, 500, 502, 503, 504):
                return None
        except Exception:
            pass

        # Exponential backoff with small jitter.
        await asyncio.sleep(0.25 * (2**attempt))

    return None


async def get_lat_lng_from_postcode(
    postcode: str,
    *,
    use_db_cache: bool = True,
) -> Dict[str, float] | None:
    """Resolve UK postcode -> {latitude, longitude}.

    Best-effort caching:
    - In-memory per-process cache (always)
    - Optional Supabase cache table (if configured and present)

    This function is intentionally tolerant: if caching fails (missing table,
    missing credentials), it falls back to live lookup.
    """

    key = _normalize_postcode(postcode)
    if not key:
        return None

    cached = _CACHE.get(key)
    if cached:
        return {"latitude": cached[0], "longitude": cached[1]}

    # DB cache (optional).
    if use_db_cache and sb is not None:
        try:
            res = (
                sb.table("postcode_cache")
                .select("postcode,latitude,longitude")
                .eq("postcode", key)
                .limit(1)
                .execute()
            )
            rows = getattr(res, "data", None)
            if isinstance(rows, list) and rows:
                row = rows[0] if isinstance(rows[0], dict) else None
                if isinstance(row, dict):
                    lat = _coerce_float(row.get("latitude"))
                    lng = _coerce_float(row.get("longitude"))
                    if lat is not None and lng is not None:
                        _CACHE[key] = (lat, lng)
                        return {"latitude": lat, "longitude": lng}
        except Exception:
            pass

    # Live lookup.
    live = await _fetch_postcodes_io(key)
    if not live:
        return None

    lat = _coerce_float(live.get("latitude"))
    lng = _coerce_float(live.get("longitude"))
    if lat is None or lng is None:
        return None

    _CACHE[key] = (lat, lng)

    # Best-effort persist to DB cache.
    if use_db_cache and sb is not None:
        try:
            sb.table("postcode_cache").upsert(
                [{"postcode": key, "latitude": lat, "longitude": lng}],
                on_conflict="postcode",
            ).execute()
        except Exception:
            pass

    return {"latitude": lat, "longitude": lng}
