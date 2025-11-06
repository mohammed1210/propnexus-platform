"""
Back-compat shim for older imports in tests.

Runtime implementation lives in `area_intel_routes.py`, but some tests still do:
    from backend.routes import area_routes

We re-export the same `router`, plus a module-level `sb` and the
`get_area_intel_from_provider` function so tests can monkeypatch them.
"""
from .area_intel_routes import router, get_area_intel_from_provider  # re-exports

# Provide `sb` so tests can monkeypatch it with `raising=True`
try:
    from .area_intel_routes import sb as _sb  # mirror real symbol if present
except Exception:
    _sb = None

sb = _sb

__all__ = ["router", "sb", "get_area_intel_from_provider"]
