from backend.scripts.backfill_top_deals import backfill_top_deals
from backend.utils.top_deal_ranker import TOP_DEAL_VERSION


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, client, table):
        self.client = client
        self.table = table
        self._range = None
        self._source = None
        self._payload = None

    def select(self, *_args, **_kwargs):
        return self

    def range(self, start, end):
        self._range = (start, end)
        return self

    def eq(self, key, value):
        if key == "source":
            self._source = value
        return self

    def upsert(self, payload, **_kwargs):
        self._payload = payload
        return self

    def execute(self):
        if self._payload is not None:
            self.client.upserts.extend(self._payload)
            return FakeResult(self._payload)
        rows = self.client.rows
        if self._source:
            rows = [row for row in rows if row.get("source") == self._source]
        if self._range:
            start, end = self._range
            rows = rows[start : end + 1]
        return FakeResult(rows)


class FakeSupabase:
    def __init__(self, rows):
        self.rows = rows
        self.upserts = []

    def table(self, name):
        assert name == "properties"
        return FakeQuery(self, name)


def row(**extra):
    base = {
        "id": "p1",
        "title": "Reduced auction terrace",
        "description": "Auction. Needs modernisation. Chain free.",
        "price": 160000,
        "source": "zoopla",
        "source_url": "https://example.test/p1",
        "image_urls": ["https://img/1.jpg", "https://img/2.jpg"],
        "postcode": "M1 1AE",
        "data": {},
    }
    base.update(extra)
    return base


def test_top_deal_backfill_applies_scores_to_unscored_rows(monkeypatch):
    sb = FakeSupabase([row()])
    monkeypatch.setattr(
        "backend.scripts.backfill_top_deals.get_sold_comps_summary",
        lambda *_args, **_kwargs: {"count": 5, "median_price": 220000},
    )
    summary = backfill_top_deals(sb, batch_size=10)
    assert summary["updated"] == 1
    assert sb.upserts[0]["top_deal_score"] is not None
    assert sb.upserts[0]["data"]["top_deal"]["evidence"]["version"] == TOP_DEAL_VERSION


def test_current_version_rows_skipped_unless_force(monkeypatch):
    scored = row(top_deal_score=50, data={"top_deal": {"evidence": {"version": TOP_DEAL_VERSION}}})
    sb = FakeSupabase([scored])
    monkeypatch.setattr(
        "backend.scripts.backfill_top_deals.get_sold_comps_summary", lambda *_a, **_k: None
    )
    summary = backfill_top_deals(sb, batch_size=10)
    assert summary["skipped"] == 1
    assert sb.upserts == []

    forced = FakeSupabase([scored])
    summary = backfill_top_deals(forced, batch_size=10, force=True)
    assert summary["updated"] == 1


def test_weak_evidence_does_not_become_prime_or_strong(monkeypatch):
    sb = FakeSupabase([row(description="Nice flat", source_url=None, image_urls=[])])
    monkeypatch.setattr(
        "backend.scripts.backfill_top_deals.get_sold_comps_summary", lambda *_a, **_k: None
    )
    summary = backfill_top_deals(sb, batch_size=10)
    assert summary["prime"] == 0
    assert summary["strong"] == 0


def test_hard_evidence_can_become_prime_or_strong(monkeypatch):
    sb = FakeSupabase([row(price=120000)])
    monkeypatch.setattr(
        "backend.scripts.backfill_top_deals.get_sold_comps_summary",
        lambda *_args, **_kwargs: {"count": 5, "median_price": 220000},
    )
    summary = backfill_top_deals(sb, batch_size=10)
    assert summary["prime"] + summary["strong"] >= 1


def test_no_bmv_wording_without_sold_comps(monkeypatch):
    sb = FakeSupabase([row(description="BMV below market auction bargain")])
    monkeypatch.setattr(
        "backend.scripts.backfill_top_deals.get_sold_comps_summary", lambda *_a, **_k: None
    )
    backfill_top_deals(sb, batch_size=10)
    reasons = sb.upserts[0]["top_deal_reasons"]
    assert not any(
        "bmv" in reason.lower() or "below market" in reason.lower() for reason in reasons
    )
