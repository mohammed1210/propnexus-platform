import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_fake")
    monkeypatch.setenv("SUPABASE_URL", "https://fake.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "fake_key")
    monkeypatch.setenv("OPENAI_API_KEY", "test_key")

    from backend.main import app

    return TestClient(app)


def test_import_all_enqueues_after_insert(client, monkeypatch):
    monkeypatch.setenv("IMPORT_ADMIN_TOKEN", "secret")

    import backend.routes.import_routes as import_routes

    # Ensure the import path considers Supabase configured.
    import_routes.sb = object()

    captured: dict[str, object] = {"called": False, "ids": None, "reason": None}

    def _fake_enqueue_property_ids(property_ids, reason: str, max_per_call: int = 200):
        captured["called"] = True
        captured["ids"] = list(property_ids)
        captured["reason"] = reason
        return {
            "requested": len(property_ids),
            "attempted": len(property_ids),
            "enqueued": len(property_ids),
        }

    async def _fake_scrape_all_sources(_loc: str, **_kwargs):
        return [
            {
                "id": "00000000-0000-0000-0000-000000000001",
                "source": "zoopla",
                "external_id": "1",
                "title": "t",
                "location": _loc,
                "price": 123,
                "url": "https://example.com/1",
            }
        ]

    async def _fake_fill_missing_coords(_rows):
        return

    monkeypatch.setattr(import_routes, "scrape_all_sources", _fake_scrape_all_sources, raising=True)
    monkeypatch.setattr(
        import_routes, "_fill_missing_coords_from_postcode", _fake_fill_missing_coords, raising=True
    )
    monkeypatch.setattr(
        import_routes, "_upsert_properties_rows", lambda **_kw: (True, None), raising=True
    )
    monkeypatch.setattr(
        import_routes, "enqueue_property_ids", _fake_enqueue_property_ids, raising=True
    )
    monkeypatch.setattr(import_routes, "create_scrape_run", lambda **_kw: "run1", raising=True)
    monkeypatch.setattr(import_routes, "finish_scrape_run", lambda **_kw: None, raising=True)

    resp = client.post("/import/all?req=London", headers={"x-admin-token": "secret"})
    assert resp.status_code == 200

    assert captured["called"] is True
    assert captured["reason"] == "post_import:all"
    assert captured["ids"] == ["00000000-0000-0000-0000-000000000001"]
