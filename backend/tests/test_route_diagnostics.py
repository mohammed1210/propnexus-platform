"""Route diagnostics smoke suite for core API endpoints.

This test file is intentionally broad and contract-focused:
- verifies critical routes are registered
- checks status codes and basic response shape
- stubs external dependencies for deterministic checks

It is not a full integration suite and should stay fast.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import textwrap
from typing import Any

import pytest
from fastapi.testclient import TestClient

try:
    from backend.main import app  # type: ignore

    _import_error = None
except Exception as exc:  # pragma: no cover
    app = None  # type: ignore[assignment]
    _import_error = exc


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    if app is None:  # pragma: no cover
        pytest.skip(f"App unavailable in CI: {_import_error}")

    monkeypatch.setenv("ENVIRONMENT", "development")
    return TestClient(app)


def _assert_keys(payload: dict[str, Any], required_keys: set[str]) -> None:
    missing = required_keys - set(payload.keys())
    assert not missing, f"Missing keys: {sorted(missing)}"


def _load_routes_in_subprocess() -> dict[str, Any]:
    script = textwrap.dedent(
        """
        import json
        import os
        import sys
        import traceback

        payload = {
            "cwd": os.getcwd(),
            "python": sys.executable,
            "sys_path_first": sys.path[:10],
            "ENVIRONMENT": os.environ.get("ENVIRONMENT"),
            "CI": os.environ.get("CI"),
            "PYTHONPATH": os.environ.get("PYTHONPATH"),
        }

        try:
            import backend

            payload["backend_file"] = getattr(backend, "__file__", None)
            payload["backend_path"] = list(getattr(backend, "__path__", []))
        except Exception:
            payload["backend_import_error"] = traceback.format_exc()

        try:
            import backend.main as main

            payload["backend_main_file"] = getattr(main, "__file__", None)
            payload["backend_main_id"] = id(main)
            for name in [
                "ai_router",
                "properties_router",
                "save_deal_router",
                "area_intel_router",
                "comps_router",
                "gpt_router",
            ]:
                payload[f"has_{name}"] = hasattr(main, name)

            app = main.app
            route_details = main._collect_registered_route_details()
            paths = sorted(
                {
                    route["path"]
                    for route in route_details
                    if isinstance(route, dict) and isinstance(route.get("path"), str)
                }
            )
            payload["route_detail_count"] = len(route_details)
            payload["route_count"] = len(paths)
            payload["paths"] = paths
        except Exception:
            payload["main_import_error"] = traceback.format_exc()

        print(json.dumps(payload))
        """
    )

    try:
        result = subprocess.run(
            [sys.executable, "-c", script],
            check=True,
            capture_output=True,
            text=True,
            env={**os.environ, "ENVIRONMENT": "development"},
        )
    except subprocess.CalledProcessError as exc:
        raise AssertionError(
            "Failed to import backend.main in clean subprocess.\n"
            f"stdout:\n{exc.stdout}\n"
            f"stderr:\n{exc.stderr}\n"
        ) from exc

    payload = json.loads(result.stdout)
    assert isinstance(payload, dict)
    assert isinstance(payload.get("paths"), list)
    return payload


def test_debug_routes_contains_critical_paths(client: TestClient) -> None:
    payload = _load_routes_in_subprocess()
    paths = set(payload["paths"])
    assert len(paths) >= 20, json.dumps(payload, indent=2, sort_keys=True)
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
