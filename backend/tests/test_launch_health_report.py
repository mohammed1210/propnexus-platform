from backend.scripts.launch_health_report import collect_launch_health


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, rows):
        self.rows = rows

    def select(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return FakeResult(self.rows)


class FakeSupabase:
    def table(self, name):
        if name == "properties":
            return FakeQuery(
                [
                    {
                        "id": "p1",
                        "source": "zoopla",
                        "source_url": "https://example.test",
                        "imageurl": "https://img.test/1.jpg",
                        "postcode": "M1 1AE",
                        "top_deal_score": 78,
                        "top_deal_tier": "prime",
                        "price_change_count": 0,
                    }
                ]
            )
        if name == "scrape_runs":
            return FakeQuery([{"source": "zoopla", "status": "success", "count_inserted": 1}])
        return FakeQuery([])


def test_launch_health_report_shape(monkeypatch):
    monkeypatch.setenv("SCRAPER_MODE", "direct")
    report = collect_launch_health(FakeSupabase())
    assert report["operational"]["scraperapi_mode"] == "disabled"
    assert report["data"]["total_properties"] == 1
    assert report["data"]["scored_properties"] == 1
    assert report["data"]["prime"] == 1
