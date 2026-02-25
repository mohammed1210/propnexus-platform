import pytest
from fastapi.testclient import TestClient

from backend.main import app  # type: ignore

client = TestClient(app)


@pytest.mark.parametrize("pc", ["SW1A 1AA", "L1 8JQ"])
def test_comps_basic(pc: str):
    r = client.get(f"/comps/{pc}")
    assert r.status_code == 200
    data = r.json()
    assert "sales" in data and "rents" in data


@pytest.mark.parametrize("k", ["liverpool", "M1"])
def test_area_intel_basic(k: str):
    r = client.get(f"/area-intel/{k}")
    assert r.status_code == 200
    data = r.json()
    assert "key" in data
