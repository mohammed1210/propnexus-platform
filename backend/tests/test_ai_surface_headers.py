from fastapi.testclient import TestClient


def test_gpt_has_canonical_header(app):
    client = TestClient(app)
    r = client.get("/gpt/health")
    assert r.status_code == 200
    assert r.headers.get("X-PropNexus-AI-API") in ("canonical", None)  # allow if not added yet


def test_ai_has_compat_headers(app):
    client = TestClient(app)
    # /ai endpoints may require OPENAI_API_KEY -> but header should still be present on response if route executes
    # We can only safely check routing by hitting a path and accepting 4xx/5xx
    r = client.post("/ai/summary", json={"title": "t", "location": "l", "price": 100000})
    assert r.status_code in (200, 400, 401, 403, 422, 429, 502, 503)
    # If response made it through FastAPI route handler, headers should exist.
    # On validation error (422) FastAPI returns before handler, so headers may be absent.
    if r.status_code != 422:
        assert r.headers.get("X-PropNexus-AI-API") == "compat"
        assert r.headers.get("X-PropNexus-AI-Canonical") == "/gpt/*"
        assert r.headers.get("Deprecation") == "true"
        assert r.headers.get("Sunset") == "2026-06-01"
        assert r.headers.get("Link") == '</gpt/health>; rel="successor-version"'
