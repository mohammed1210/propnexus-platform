"""
Back-compat shim for older imports in tests.

Runtime implementation lives in `area_intel_routes.py`, but tests still import:
    from backend.routes import area_routes

We re-export the same `router` AND we also expose a module-level `sb`
attribute so tests can monkeypatch it with `raising=True`.
"""
from .area_intel_routes import router  # re-export router

# Provide `sb` so tests can monkeypatch it.
try:
    from .area_intel_routes import sb as _sb  # if the real one exists, mirror it
except Exception:
    _sb = None  # fallback; tests will monkeypatch over this

sb = _sb
