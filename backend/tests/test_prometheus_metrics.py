from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_metrics_endpoint_exposes_http_requests_total() -> None:
    # Generate at least one request so the counter is present.
    client.get("/health")

    res = client.get("/metrics")
    assert res.status_code == 200
    body = res.text
    assert "http_requests_total" in body
