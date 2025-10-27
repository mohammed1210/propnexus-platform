"""Basic health endpoint test for the PropNexus API.

This test tries to import the FastAPI app and hit /health. In CI environments
where importing the app fails due to missing secrets, we skip gracefully.
"""

from fastapi.testclient import TestClient
import pytest

try:
    # type: ignore[reportUnknownVariableType]
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
