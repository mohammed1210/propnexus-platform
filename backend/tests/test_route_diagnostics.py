"""Route diagnostics smoke suite for core API endpoints.

This test file is intentionally broad and contract-focused:
- verifies critical routes are registered
- checks status codes and basic response shape
- stubs external dependencies for deterministic checks

It is not a full integration suite and should stay fast.
"""

from __future__ import annotations

import importlib
import os
import sys
from collections.abc import Iterable
from types import ModuleType
from typing import Any

import pytest
from fastapi.testclient import TestClient


def _unbind_parent_attr(name: str) -> None:
    parent_name, _, child_name = name.rpartition(".")
    if not parent_name or not child_name:
        return

    parent_module = sys.modules.get(parent_name)
    if parent_module is not None and getattr(parent_module, child_name, None) is not None:
        try:
            delattr(parent_module, child_name)
        except Exception:
            pass


def _purge_modules(prefixes: Iterable[str]) -> None:
    names = [
        name
        for name in list(sys.modules)
        if any(name == prefix or name.startswith(f"{prefix}.") for prefix in prefixes)
    ]
    for name in sorted(names, key=lambda module_name: module_name.count("."), reverse=True):
        _unbind_parent_attr(name)
        sys.modules.pop(name, None)


def _snapshot_modules(prefixes: Iterable[str]) -> dict[str, ModuleType]:
    return {
        name: module
        for name, module in list(sys.modules.items())
        if module is not None
        if any(name == prefix or name.startswith(f"{prefix}.") for prefix in prefixes)
    }


def _bind_module(name: str, module: ModuleType) -> None:
    sys.modules[name] = module

    parent_name, _, child_name = name.rpartition(".")
    if parent_name and child_name:
        parent_module = sys.modules.get(parent_name)
        if parent_module is not None:
            setattr(parent_module, child_name, module)


def _restore_modules(snapshot: dict[str, ModuleType], prefixes: Iterable[str]) -> None:
    _purge_modules(prefixes)
    for name, module in sorted(snapshot.items(), key=lambda item: item[0].count(".")):
        _bind_module(name, module)


def _reset_route_metrics() -> None:
    try:
        from prometheus_client import REGISTRY
    except Exception:
        return

    metric_names = {
        "filter_click",
        "filter_click_total",
        "filter_click_created",
        "search_requests",
        "search_requests_total",
        "search_requests_created",
        "search_zero_results",
        "search_zero_results_total",
        "search_zero_results_created",
        "search_ml_fallback",
        "search_ml_fallback_total",
        "search_ml_fallback_created",
    }

    collectors = {
        REGISTRY._names_to_collectors[name]  # type: ignore[attr-defined]
        for name in metric_names
        if name in REGISTRY._names_to_collectors  # type: ignore[attr-defined]
    }
    for collector in collectors:
        try:
            REGISTRY.unregister(collector)
        except Exception:
            pass


def _load_fresh_app():
    importlib.invalidate_caches()
    _reset_route_metrics()
    _purge_modules(["backend.main", "backend.routes"])

    try:
        module = importlib.import_module("backend.main")
    except Exception as exc:  # pragma: no cover
        pytest.skip(f"App unavailable in CI: {exc}")

    return module.app


@pytest.fixture(scope="module")
def fresh_app():
    module_prefixes = ("backend.main", "backend.routes")
    prior_environment = os.environ.get("ENVIRONMENT")
    module_snapshot = _snapshot_modules(module_prefixes)
    os.environ["ENVIRONMENT"] = "development"
    try:
        yield _load_fresh_app()
    finally:
        _restore_modules(module_snapshot, module_prefixes)
        if prior_environment is None:
            os.environ.pop("ENVIRONMENT", None)
        else:
            os.environ["ENVIRONMENT"] = prior_environment


@pytest.fixture
def client(fresh_app) -> TestClient:
    with TestClient(fresh_app) as test_client:
        yield test_client


def _assert_keys(payload: dict[str, Any], required_keys: set[str]) -> None:
    missing = required_keys - set(payload.keys())
    assert not missing, f"Missing keys: {sorted(missing)}"


def _route_debug_context(paths: set[str]) -> str:
    backend_module = sys.modules.get("backend")
    backend_main_module = sys.modules.get("backend.main")

    return (
        f"backend.main_id={id(backend_main_module) if backend_main_module is not None else None}; "
        f"backend.main_file={getattr(backend_main_module, '__file__', None)}; "
        f"backend_has_main={hasattr(backend_module, 'main') if backend_module is not None else False}; "
        f"backend_has_routes={hasattr(backend_module, 'routes') if backend_module is not None else False}; "
        f"paths={sorted(paths)[:20]}"
    )


def test_debug_routes_contains_critical_paths(client: TestClient) -> None:
    resp = client.get("/debug/routes")
    assert resp.status_code == 200

    body = resp.json()
    assert isinstance(body, dict)
    assert isinstance(body.get("paths"), list)

    paths = set(body["paths"])
    assert (
        len(paths) >= 20
    ), f"Unexpectedly low route count: {len(paths)}; {_route_debug_context(paths)}"
    critical = {
        "/",
        "/health",
        "/config",
        "/properties",
        "/api/v1/search",
        "/gpt/score",
        "/ai/summary",
        "/save-deal",
        "/saved-deals",
        "/events/filter_select",
        "/area-intel/{key}",
        "/comps/{postcode}",
    }
    missing = critical - paths
    assert not missing, f"Critical routes not registered: {sorted(missing)}"


def test_health_and_config_contract(client: TestClient) -> None:
    health = client.get("/health")
    assert health.status_code == 200
    health_body = health.json()
    assert isinstance(health_body, dict)
    _assert_keys(
        health_body,
        {"status", "service", "version", "environment", "supabase_configured"},
    )
    assert isinstance(health_body["supabase_configured"], bool)

    config = client.get("/config")
    assert config.status_code == 200
    config_body = config.json()
    assert isinstance(config_body, dict)
    _assert_keys(config_body, {"status", "service", "supabase"})
    assert config_body["status"] in {"ok", "degraded"}
    assert isinstance(config_body["supabase"], dict)
    _assert_keys(
        config_body["supabase"],
        {"configured", "required_vars", "missing_vars", "db_reachable", "detail"},
    )


def test_property_search_contract(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import backend.routes.properties_routes as routes

    monkeypatch.setattr(
        routes,
        "query_db",
        lambda payload: {
            "items": [{"id": "prop-1", "title": "Sample Property", "location": "London"}],
            "total_results": 1,
        },
        raising=True,
    )
    monkeypatch.setattr(routes, "get_facets", lambda payload: {"beds": [1, 2]}, raising=True)
    monkeypatch.setattr(routes.settings, "SEARCH_INSTANCE", "blue", raising=True)
    monkeypatch.delenv("SERVICE_URL_search_blue", raising=False)

    resp = client.post(
        "/api/v1/search",
        json={"q": "london", "filters": {}, "allow_broaden": True, "limit": 10, "offset": 0},
    )
    assert resp.status_code == 200

    body = resp.json()
    assert isinstance(body, dict)
    _assert_keys(
        body,
        {
            "q",
            "filters",
            "items",
            "count",
            "total_results",
            "facets",
            "limit",
            "offset",
            "served_by",
        },
    )
    assert body["q"] == "london"
    assert isinstance(body["items"], list)
    assert isinstance(body["facets"], dict)
    assert body["served_by"] in {"local", "blue", "green"}


def test_ai_scoring_contract(client: TestClient) -> None:
    resp = client.post(
        "/gpt/score",
        json={
            "price": 220000,
            "location": "London",
            "bedrooms": 2,
            "yield_percent": 6.2,
            "roi_percent": 11.4,
        },
    )
    assert resp.status_code == 200

    body = resp.json()
    assert isinstance(body, dict)
    _assert_keys(body, {"ok", "score", "categories", "version"})
    assert body["ok"] is True
    assert isinstance(body["score"], int)
    assert isinstance(body["categories"], dict)


def test_ai_summary_contract_with_stub(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import backend.routes.ai as ai_routes
    from backend.schemas.ai import SummaryResponse

    monkeypatch.setattr(ai_routes.ai_service, "require_api_key", lambda: "test-key", raising=True)

    async def _fake_generate_summary(req):
        return SummaryResponse(summary="Stub summary", bullets=["Point 1", "Point 2"])

    monkeypatch.setattr(
        ai_routes.ai_service, "generate_summary", _fake_generate_summary, raising=True
    )

    resp = client.post(
        "/ai/summary",
        json={"title": "Deal", "location": "London", "price": 250000, "yield": 5.5, "roi": 10.2},
    )
    assert resp.status_code == 200

    body = resp.json()
    assert isinstance(body, dict)
    _assert_keys(body, {"summary", "bullets"})
    assert isinstance(body["summary"], str)
    assert isinstance(body["bullets"], list)


def test_saved_deals_contracts(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import backend.routes.save_deal as save_routes

    # Avoid hard dependency on a real Supabase backend.
    monkeypatch.setattr(save_routes, "_require_supabase", lambda: object(), raising=True)
    monkeypatch.setenv("PROPNEXUS_INTERNAL_API_TOKEN", "test-internal-token")

    # Save endpoint should reject invalid body shape.
    bad_save = client.post("/save-deal", json={})
    assert bad_save.status_code == 400
    assert isinstance(bad_save.json(), dict)
    assert "detail" in bad_save.json()

    # Saved-deals list should fail closed for anonymous/no-token calls.
    saved_list = client.get("/saved-deals")
    assert saved_list.status_code == 401
    body = saved_list.json()
    assert isinstance(body, dict)
    _assert_keys(body, {"detail"})


def test_events_contract(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import backend.routes.events as event_routes

    class _FakeSupabase:
        def schema(self, _name: str):
            return self

        def table(self, _name: str):
            return self

        def insert(self, _row: dict[str, Any]):
            return self

        def execute(self):
            class _Result:
                data = []

            return _Result()

    monkeypatch.setattr(event_routes, "require_sb", lambda: _FakeSupabase(), raising=True)

    ok = client.post("/events/filter_select", json={"facet": "price", "value": "250000"})
    assert ok.status_code == 200
    assert ok.json() == {"ok": True}

    invalid = client.post("/events/search_click", json={})
    assert invalid.status_code == 422


def test_area_and_comps_contract(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import backend.routes.area_intel_routes as area_routes
    import backend.routes.comps_routes as comps_routes

    monkeypatch.setattr(
        area_routes,
        "get_area_intel_from_provider",
        lambda key: {"key": key, "crime_score": 0.12},
        raising=True,
    )
    monkeypatch.setattr(
        comps_routes,
        "get_comps_from_provider",
        lambda pc: {"postcode": pc, "sales": [{"price": 300000}], "rents": [{"pcm": 1800}]},
        raising=True,
    )

    area = client.get("/area-intel/SW1A")
    assert area.status_code == 200
    area_body = area.json()
    assert isinstance(area_body, dict)
    _assert_keys(area_body, {"key", "crime_score"})

    comps = client.get("/comps/sw1a")
    assert comps.status_code == 200
    comps_body = comps.json()
    assert isinstance(comps_body, dict)
    _assert_keys(comps_body, {"source", "postcode", "sales", "rents"})
    assert comps_body["source"] == "provider"
    assert comps_body["postcode"] == "SW1A"
    assert isinstance(comps_body["sales"], list)
    assert isinstance(comps_body["rents"], list)
