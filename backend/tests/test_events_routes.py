from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


class _FakeTable:
    def insert(self, _row):
        return self

    def execute(self):
        return type("Res", (), {"data": [{"ok": True}]})()


class _FakeSchema:
    def table(self, _name):
        return _FakeTable()


class _FakeSB:
    def schema(self, _name):
        return _FakeSchema()

    def table(self, _name):
        return _FakeTable()


def test_search_click_event_accepts_valid_payload(monkeypatch):
    from backend.routes import events

    monkeypatch.setattr(events, "require_sb", lambda: _FakeSB())

    body = {
        "query_id": "9f5ec88e-6a11-44d5-865e-fdf2d599f165",
        "listing_id": "4de72852-6a3c-4d1b-9a66-ddf2bafc2ced",
        "rank": 1,
    }
    res = client.post("/events/search_click", json=body)
    assert res.status_code == 200
    assert res.json().get("ok") is True


def test_search_click_event_rejects_invalid_uuid():
    body = {
        "query_id": "not-a-uuid",
        "listing_id": "4de72852-6a3c-4d1b-9a66-ddf2bafc2ced",
        "rank": 1,
    }
    res = client.post("/events/search_click", json=body)
    assert res.status_code == 422


def test_filter_select_event_accepts_valid_payload(monkeypatch):
    from backend.routes import events

    monkeypatch.setattr(events, "require_sb", lambda: _FakeSB())

    body = {
        "facet": "price",
        "value": "0-300k",
    }
    res = client.post("/events/filter_select", json=body)
    assert res.status_code == 200
    assert res.json().get("ok") is True


def test_filter_select_event_rejects_missing_facet(monkeypatch):
    from backend.routes import events

    monkeypatch.setattr(events, "require_sb", lambda: _FakeSB())

    body = {
        "facet": "",
        "value": "0-300k",
    }
    res = client.post("/events/filter_select", json=body)
    assert res.status_code == 422
