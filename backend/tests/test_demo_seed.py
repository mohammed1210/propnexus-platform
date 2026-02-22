from fastapi.testclient import TestClient


class _FakeUpsertQuery:
    def __init__(self, storage, table_name: str, rows):
        self._storage = storage
        self._table_name = table_name
        self._rows = rows

    def execute(self):
        self._storage.setdefault(self._table_name, []).extend(self._rows)

        class R:
            data = None

        r = R()
        r.data = self._rows
        return r


class _FakeTable:
    def __init__(self, storage, table_name: str):
        self._storage = storage
        self._table_name = table_name

    def upsert(self, rows, on_conflict=None):
        if isinstance(rows, dict):
            rows = [rows]
        return _FakeUpsertQuery(self._storage, self._table_name, list(rows or []))


class _FakeSB:
    def __init__(self, storage):
        self._storage = storage

    def table(self, name: str):
        return _FakeTable(self._storage, name)


def test_seed_demo_requires_admin_token(monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "secret")

    from backend.main import app

    client = TestClient(app)
    resp = client.post("/admin/seed-demo")
    assert resp.status_code == 401


def test_seed_demo_upserts_demo_properties(monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "secret")

    import backend.routes.demo_seed as demo_seed

    storage = {}
    monkeypatch.setattr(demo_seed, "sb", _FakeSB(storage), raising=True)

    from backend.main import app

    client = TestClient(app)
    resp = client.post("/admin/seed-demo", headers={"x-admin-token": "secret"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["source"] == "demo"
    assert body["seeded"] >= 1

    rows = storage.get("properties") or []
    assert len(rows) == body["seeded"]
    assert all(r.get("source") == "demo" for r in rows)
    assert any(r.get("external_id") for r in rows)
