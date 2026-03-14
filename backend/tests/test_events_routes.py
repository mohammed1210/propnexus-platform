from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


class _FakeTable:
    def __init__(self, store, name):
        self._store = store
        self._name = name
        self._insert_row = None
        self._eq_filters = []
        self._gte_filters = []
        self._is_select = False

    def select(self, _cols):
        self._is_select = True
        return self

    def eq(self, key, value):
        self._eq_filters.append((key, value))
        return self

    def gte(self, key, value):
        self._gte_filters.append((key, value))
        return self

    def limit(self, _n):
        return self

    def insert(self, _row):
        self._insert_row = _row
        return self

    def execute(self):
        rows = self._store.setdefault(self._name, [])
        if self._insert_row is not None:
            rows.append(self._insert_row)
            return type("Res", (), {"data": [self._insert_row]})()

        if self._is_select:
            out = list(rows)
            for key, value in self._eq_filters:
                out = [r for r in out if r.get(key) == value]
            for key, value in self._gte_filters:
                out = [r for r in out if str(r.get(key, "")) >= str(value)]
            return type("Res", (), {"data": out[:1]})()

        return type("Res", (), {"data": [{"ok": True}]})()


class _FakeSchema:
    def __init__(self, store):
        self._store = store

    def table(self, _name):
        return _FakeTable(self._store, _name)


class _FakeSB:
    def __init__(self):
        self._store = {}

    def schema(self, _name):
        return _FakeSchema(self._store)

    def table(self, _name):
        return _FakeTable(self._store, _name)


def test_search_click_event_accepts_valid_payload(monkeypatch):
    from backend.routes import events

    monkeypatch.setattr(events, "require_sb", lambda: _FakeSB())

    body = {
        "query_id": "9f5ec88e-6a11-44d5-865e-fdf2d599f165",
        "listing_id": "4de72852-6a3c-4d1b-9a66-ddf2bafc2ced",
        "rank": 1,
        "clerk_user_id": "user_2mYtQExampleClerkId",
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


def test_search_click_event_dedupes_same_session_query_property_within_10s(monkeypatch):
    from backend.routes import events

    fake_sb = _FakeSB()
    created_at = (datetime.now(timezone.utc) - timedelta(seconds=3)).isoformat()
    fake_sb._store["search_clicks"] = [
        {
            "id": "1",
            "session_id": "session-1",
            "query": "london",
            "property_id": "4de72852-6a3c-4d1b-9a66-ddf2bafc2ced",
            "created_at": created_at,
        }
    ]
    monkeypatch.setattr(events, "require_sb", lambda: fake_sb)

    body = {
        "query": "london",
        "session_id": "session-1",
        "property_id": "4de72852-6a3c-4d1b-9a66-ddf2bafc2ced",
        "position": 1,
        "filters_json": {"beds": 2},
        "query_id": "9f5ec88e-6a11-44d5-865e-fdf2d599f165",
        "listing_id": "4de72852-6a3c-4d1b-9a66-ddf2bafc2ced",
        "rank": 1,
    }

    res = client.post("/events/search_click", json=body)
    assert res.status_code == 200
    assert res.json().get("deduped") is True
    assert len(fake_sb._store.get("search_clicks", [])) == 1
