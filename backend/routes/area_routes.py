"""
Back-compat shim for older imports in tests.

Runtime implementation moved to `area_intel_routes.py`, but tests still import:
    from backend.routes import area_routes

We re-export the same `router`, plus expose:
- `sb`                          (tests monkeypatch this)
- `get_area_intel_from_provider`(tests monkeypatch this)
- `get_area_intel`              (tests call this directly)
"""
from .area_intel_routes import (
    router,
    get_area_intel_from_provider,
    get_area_intel,
)

# Provide `sb` so tests can monkeypatch it with raising=True
try:
    from .area_intel_routes import sb as _sb
except Exception:
    _sb = None

sb = _sb

__all__ = ["router", "sb", "get_area_intel_from_provider", "get_area_intel"]
