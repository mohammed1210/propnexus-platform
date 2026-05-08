from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import Mock

from backend.services import providers


class _Query:
    def __init__(self, rows):
        self.rows = rows
        self.single = False

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def ilike(self, column, pattern):
        if column == "postcode":
            prefix = str(pattern).replace("%", "").upper()
            self.rows = [
                r for r in self.rows if str(r.get("postcode") or "").upper().startswith(prefix)
            ]
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, n):
        self.rows = self.rows[: int(n)]
        return self

    def maybe_single(self):
        self.single = True
        return self

    def execute(self):
        data = self.rows[0] if self.single and len(self.rows) == 1 else self.rows
        return SimpleNamespace(data=data)

    def upsert(self, *_args, **_kwargs):
        return self


class _FakeSupabase:
    def __init__(self):
        self.properties = [
            {
                "id": "prop-1",
                "title": "Real rental listing",
                "postcode": "IG3 8AA",
                "address": "12 High Road",
                "property_type": "flat",
                "bedrooms": 2,
                "data": {"rent_monthly": 1350},
                "url": "https://example.test/listing",
                "updated_at": "2026-03-20T00:00:00Z",
            }
        ]
        self.cache = []

    def table(self, name):
        if name == "properties":
            return _Query(list(self.properties))
        return _Query([])


def test_providers_no_longer_return_mock_data(monkeypatch):
    monkeypatch.setattr(providers, "get_supabase", lambda required=False: None)
    monkeypatch.setattr(providers, "_crime_summary", lambda *_args, **_kwargs: None)

    comps = providers.get_comps_from_provider("IG3")
    intel = providers.get_area_intel_from_provider("IG3")
    combined = f"{comps} {intel}"

    assert "Mock intel" not in combined
    assert "Replace with live sources" not in combined
    assert "10 IG3 Street" not in combined
    assert comps["sales"] == []
    assert comps["rents"] == []
    assert intel["population"] is None
    assert intel["schools_rating"] is None


def test_comps_returns_ppd_and_internal_rent_comps(monkeypatch):
    fake = _FakeSupabase()
    monkeypatch.setattr(providers, "get_supabase", lambda required=False: fake)
    monkeypatch.setattr(
        providers,
        "safe_select_ppd_sales",
        lambda *_args, **_kwargs: [
            {
                "price": 305000,
                "date_of_transfer": "2026-02-01",
                "postcode": "IG3 8AA",
                "property_type": "T",
                "tenure": "F",
                "paon": "14",
                "street": "High Road",
                "town_city": "ILFORD",
            }
        ],
    )

    payload = providers.get_comps_from_provider("IG3 8AA")

    assert payload["sales"][0]["price"] == 305000
    assert payload["sales"][0]["source"] == "land_registry_ppd"
    assert payload["rents"][0]["rent_monthly"] == 1350
    assert payload["rents"][0]["source"] == "internal_property_listings"


def test_comps_for_full_postcode_prefers_exact_then_sector_then_outward(monkeypatch):
    fake = _FakeSupabase()
    monkeypatch.setattr(providers, "get_supabase", lambda required=False: fake)
    calls = []

    def _fake_ppd(_sb, *, postcode_prefix, match_mode, **_kwargs):
        calls.append((match_mode, postcode_prefix))
        if match_mode == "exact":
            return [
                {
                    "price": 300000,
                    "date_of_transfer": "2026-03-01",
                    "postcode": "IG3 8AA",
                    "paon": "1",
                    "street": "Exact Road",
                }
            ]
        if match_mode == "sector":
            return [
                {
                    "price": 310000,
                    "date_of_transfer": "2026-03-02",
                    "postcode": "IG3 8AB",
                    "paon": "2",
                    "street": "Sector Road",
                }
            ]
        return [
            {
                "price": 320000,
                "date_of_transfer": "2026-03-03",
                "postcode": "IG3 9AA",
                "paon": "3",
                "street": "Outward Road",
            }
        ]

    monkeypatch.setattr(providers, "safe_select_ppd_sales", _fake_ppd)

    payload = providers.get_comps_from_provider("IG3 8AA")

    assert calls == [("exact", "IG3 8AA"), ("sector", "IG3 8"), ("outward", "IG3")]
    assert [sale["match_level"] for sale in payload["sales"][:3]] == [
        "exact",
        "sector",
        "outward",
    ]
    assert payload["source_details"]["sales_match_level"] == "exact"


def test_area_intel_uses_real_sources_and_derived_metadata(monkeypatch):
    fake = _FakeSupabase()
    monkeypatch.setattr(providers, "get_supabase", lambda required=False: fake)
    monkeypatch.setattr(
        providers,
        "_geocode_with_cache",
        lambda *_args, **_kwargs: (51.56, 0.10, {}, "postcodes.io"),
    )
    monkeypatch.setattr(
        providers,
        "_crime_summary",
        lambda *_args, **_kwargs: {"count": 7, "month": "2026-03", "source": "police.uk"},
    )
    monkeypatch.setattr(
        providers,
        "safe_select_ppd_sales",
        lambda *_args, **_kwargs: [
            {"price": 300000, "date_of_transfer": "2026-01-01", "postcode": "IG3 8AA"},
            {"price": 310000, "date_of_transfer": "2026-02-01", "postcode": "IG3 9BB"},
        ],
    )

    payload = providers.get_area_intel_from_provider("IG3 8AA")

    assert payload["avg_price"] == 305000
    assert payload["avg_rent"] == 1350
    assert payload["rental_yield_percent"]
    assert payload["crime"] == {"count": 7, "month": "2026-03", "source": "police.uk"}
    assert payload["source_details"]["sales"] == "land_registry_ppd"
    assert payload["source_details"]["rent"] == "internal_property_listings"
    assert payload["source_details"]["schools"] == "not_available"
    assert payload["population"] is None


def test_crime_summary_marks_police_source(monkeypatch):
    monkeypatch.setenv("CRIME_ENABLE", "1")
    monkeypatch.setattr(
        providers,
        "fetch_crime_police_uk",
        lambda **_kwargs: Mock(),
    )
    monkeypatch.setattr(
        providers, "_run", lambda _coro: {"source": "police.uk", "count": 3, "month": "2026-03"}
    )

    assert providers._crime_summary(51.5, -0.1) == {
        "count": 3,
        "month": "2026-03",
        "source": "police.uk",
    }
