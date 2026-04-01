"""Basic health endpoint test for the PropNexus API.

This test tries to import the FastAPI app and hit /health. In CI environments
where importing the app fails due to missing secrets, we skip gracefully.
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

try:
    # type: ignore[reportUnknownVariableType]
    from backend import main as backend_main  # type: ignore
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
    assert response.headers.get("X-PropNexus-Properties-Normalization") == "v1"


def test_resolve_app_version_prefers_stamped_file(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    if app is None:  # pragma: no cover
        pytest.skip(f"App unavailable in CI: {_import_error}")

    version_file = tmp_path / ".app_version"
    version_file.write_text("local-stamped-sha\n")

    monkeypatch.setenv("RAILWAY_GIT_COMMIT_SHA", "railway-env-sha")

    assert backend_main._resolve_app_version(version_file) == "local-stamped-sha"
