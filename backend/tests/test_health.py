"""Basic health endpoint test for the PropNexus API.

This test verifies that the `/health` endpoint returns HTTP 200 and that
the response payload contains at least one of the expected keys. It is designed
to be tolerant of different health response shapes (e.g. { "ok": true },
{ "status": "healthy" }, etc.).
"""

from fastapi.testclient import TestClient

try:
    # Attempt to import the FastAPI app from the main module.
    from main import app  # type: ignore
except ImportError as exc:
    raise RuntimeError(
        "Could not import the FastAPI app. Ensure your backend exposes 'app' in main.py."
    ) from exc

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"
    data = response.json()
    assert isinstance(data, dict), "Health endpoint should return a JSON object"
    # Accept different health shapes: ok, status or healthy keys
    keys = [k.lower() for k in data.keys()]
    assert any(
        k in ("ok", "status", "healthy") for k in keys
    ), f"Health response keys {list(data.keys())} do not contain any of the expected keys"
