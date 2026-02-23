"""Back-compat shim for older imports used by tests.

Runtime implementation moved to `area_intel_routes.py`, but tests still import:
    from backend.routes import area_routes

We re-export:
  - `router`
  - `sb` (so tests can monkeypatch it)
  - `get_area_intel_from_provider` (so tests can monkeypatch it)
And we provide a thin `get_area_intel()` that behaves like the old route:
  - cache miss -> call provider and return {"source": "provider", ...}
  - cache hit  -> return {"source": "cache", ...}
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from .area_intel_routes import get_area_intel_from_provider, router  # type: ignore

try:
    from .area_intel_routes import sb as _real_sb  # type: ignore
except Exception:
    _real_sb = None

sb = _real_sb
_fallback_storage: Dict[str, Dict[str, Any]] = {}


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    global sb, _fallback_storage
    if sb is not None:
        for attr in ("get", "get_json"):
            if hasattr(sb, attr):
                fn = getattr(sb, attr)
                try:
                    return fn(key)  # type: ignore[misc]
                except TypeError:
                    try:
                        return fn(key, None)  # type: ignore[misc]
                    except Exception:
                        pass
    return _fallback_storage.get(key)


def _cache_set(key: str, value: Dict[str, Any], ttl: int = 900) -> None:
    global sb, _fallback_storage
    if sb is not None:
        for attr in ("set", "set_json", "put"):
            if hasattr(sb, attr):
                fn = getattr(sb, attr)
                try:
                    fn(key, value, ttl)  # type: ignore[misc]
                    return
                except TypeError:
                    try:
                        fn(key, value)  # type: ignore[misc]
                        return
                    except Exception:
                        pass
    _fallback_storage[key] = value


def get_area_intel(key: str, request: Any = None) -> Dict[str, Any]:
    cache_key = f"area:{key}"
    cached = _cache_get(cache_key)
    if isinstance(cached, dict):
        out = dict(cached)
        out["source"] = "cache"
        return out

    payload = get_area_intel_from_provider(key)
    if not isinstance(payload, dict):
        payload = {"key": key, "data": payload}
    _cache_set(cache_key, payload, ttl=900)
    out = dict(payload)
    out["source"] = "provider"
    return out


__all__ = ["router", "sb", "get_area_intel_from_provider", "get_area_intel"]
