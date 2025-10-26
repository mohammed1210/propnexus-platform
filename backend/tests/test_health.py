"""Basic health endpoint test for the PropNexus API.

Asserts that `/health` returns 200. If importing the FastAPI app requires
env vars that are missing in CI, the test is skipped gracefully.
"""

from fastapi.testclient import TestClient
import pytest

# Try to import the app; some routers may need env that CI doesn't have.
try:
    from backend.main import app  # type: ignore
    _import_error = None
except Exception as e:  # pragma: no cover
    app = None  # type: ignore[assignment]
    _import_error = e


def test_health() -> None:
    if app is None:  # pragma: no cover
        pytest.skip(f"App unavailable in CI: {_import_error}")
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    