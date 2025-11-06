"""
Back-compat shim for older imports in tests.

Runtime has moved to `area_intel_routes.py`, but some tests still do:
    from backend.routes import area_routes
This re-exports the same `router` object so those imports continue to work.
"""
from .area_intel_routes import router
