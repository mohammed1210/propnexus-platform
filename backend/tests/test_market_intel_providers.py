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
        self.postcode_geo_cache = []
        self.cache = []

    def table(self, name):
        if name == "properties":
            return _Query(list(self.properties))
        if name == "postcode_geo_cache":
            return _Query(list(self.postcode_geo_cache))
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
    assert intel["avg_rent"] is None
    assert intel["rent_source"] == "unavailable"
    assert intel["crime_source"] == "unavailable"


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
    assert payload["crime"]["count"] == 7
    assert payload["crime"]["month"] == "2026-03"
    assert payload["crime"]["source"] == "police.uk"
    assert payload["crime_source"] == "police.uk"
    assert payload["crime_period"] == "2026-03"
    assert payload["crime_count"] == 7
    assert payload["crime_signal"] == "low"
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
        "period": "2026-03",
        "source": "police.uk",
        "signal": "low",
        "radius_label": "approx. 1 mile",
        "note": "Reported nearby street-level incidents from police.uk; not a safety rating.",
    }


def test_area_intel_uses_derived_rent_only_when_no_rental_comps(monkeypatch):
    fake = _FakeSupabase()
    fake.properties = [
        {
            "id": "prop-sale-1",
            "title": "Sale listing with derived rent",
            "postcode": "IG3 8AA",
            "address": "14 High Road",
            "data": {"score_breakdown": {"inputs": {"rent_monthly": 1450}}},
            "updated_at": "2026-03-20T00:00:00Z",
        }
    ]
    monkeypatch.setattr(providers, "get_supabase", lambda required=False: fake)
    monkeypatch.setattr(
        providers,
        "_geocode_with_cache",
        lambda *_args, **_kwargs: (None, None, None, "not_available"),
    )
    monkeypatch.setattr(providers, "safe_select_ppd_sales", lambda *_args, **_kwargs: [])

    payload = providers.get_area_intel_from_provider("IG3 8AA")

    assert payload["avg_rent"] == 1450
    assert payload["rent_source"] == "derived_internal_estimate"
    assert payload["rent_evidence_count"] == 0
    assert payload["rent_estimate_count"] == 1
    assert payload["is_proxy"] is True
    assert payload["source_details"]["rent"] == "derived_internal_estimate"


def test_area_intel_prefers_true_rental_comps_over_derived_estimates(monkeypatch):
    fake = _FakeSupabase()
    fake.properties.append(
        {
            "id": "prop-sale-2",
            "title": "Sale listing estimate",
            "postcode": "IG3 8AB",
            "address": "16 High Road",
            "data": {"score_breakdown": {"inputs": {"rent_monthly": 2100}}},
            "updated_at": "2026-03-21T00:00:00Z",
        }
    )
    monkeypatch.setattr(providers, "get_supabase", lambda required=False: fake)
    monkeypatch.setattr(
        providers,
        "_geocode_with_cache",
        lambda *_args, **_kwargs: (None, None, None, "not_available"),
    )
    monkeypatch.setattr(providers, "safe_select_ppd_sales", lambda *_args, **_kwargs: [])

    payload = providers.get_area_intel_from_provider("IG3 8AA")

    assert payload["avg_rent"] == 1350
    assert payload["rent_source"] == "internal_property_listings"
    assert payload["rent_evidence_count"] == 1
    assert payload["rent_estimate_count"] == 0
    assert payload["is_proxy"] is False


def test_crime_not_requested_for_outward_only_postcode(monkeypatch):
    called = False

    def _fake_run(_coro):
        nonlocal called
        called = True
        return {"source": "police.uk", "count": 99, "month": "2026-03"}

    monkeypatch.setattr(providers, "_run", _fake_run)

    lat, lng, raw, source = providers._geocode_with_cache(None, "IG3")

    assert (lat, lng, raw, source) == (None, None, None, "not_available")
    assert called is False


def test_geocode_cache_allows_negative_longitude(monkeypatch):
    fake = _FakeSupabase()
    fake.postcode_geo_cache = [
        {
            "postcode": "SW1A 1AA",
            "latitude": 51.501,
            "longitude": -0.141,
            "source": "postcodes.io",
            "raw": {"cached": True},
            "fetched_at": "2026-03-01T00:00:00Z",
        }
    ]
    monkeypatch.setattr(providers, "is_fresh", lambda **_kwargs: True)
    monkeypatch.setattr(
        providers,
        "_run",
        lambda _coro: (_ for _ in ()).throw(AssertionError("live geocode should not run")),
    )

    lat, lng, raw, source = providers._geocode_with_cache(fake, "SW1A 1AA")

    assert lat == 51.501
    assert lng == -0.141
    assert raw == {"cached": True}
    assert source == "postcodes.io"


def test_crime_failure_does_not_break_area_intel(monkeypatch):
    fake = _FakeSupabase()
    monkeypatch.setattr(providers, "get_supabase", lambda required=False: fake)
    monkeypatch.setattr(
        providers,
        "_geocode_with_cache",
        lambda *_args, **_kwargs: (51.56, 0.10, {}, "postcodes.io"),
    )
    monkeypatch.setattr(providers, "_crime_summary", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(providers, "safe_select_ppd_sales", lambda *_args, **_kwargs: [])

    payload = providers.get_area_intel_from_provider("IG3 8AA")

    assert payload["crime"] is None
    assert payload["crime_source"] == "unavailable"
    assert payload["crime_count"] is None
