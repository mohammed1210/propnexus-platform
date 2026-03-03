from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_promote_route_without_bucket_returns_ok(monkeypatch):
    monkeypatch.setenv("ADMIN_ML_SECRET", "sec")
    monkeypatch.setenv("ML_MODEL_BUCKET", "")

    resp = client.post("/admin/ml/promote?token=sec&key=ignored")

    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["model"] == "ignored"


def test_promote_route_rejects_bad_token(monkeypatch):
    monkeypatch.setenv("ADMIN_ML_SECRET", "sec")

    resp = client.post("/admin/ml/promote?token=wrong&key=ignored")

    assert resp.status_code == 401
