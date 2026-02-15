from backend.utils.canonical_metrics import derive_canonical_metrics


def test_derive_canonical_metrics_computes_yield_from_rent_and_price():
    m = derive_canonical_metrics({"price": "£100,000", "rent": "£1,000 pcm"})
    assert m["price"] == 100000.0
    assert m["rent_monthly"] == 1000.0
    assert round(float(m["yield_percent"]), 2) == 12.0
    assert m["roi_percent"] is None


def test_derive_canonical_metrics_computes_rent_from_yield_and_price():
    m = derive_canonical_metrics({"price": 200000, "yield_percent": "6%"})
    assert m["price"] == 200000.0
    assert round(float(m["rent_monthly"]), 2) == 1000.0
    assert m["yield_percent"] == 6.0


def test_derive_canonical_metrics_missing_values_stay_null_not_zero():
    m = derive_canonical_metrics({"id": "x"})
    assert m["price"] is None
    assert m["rent_monthly"] is None
    assert m["yield_percent"] is None
    assert m["roi_percent"] is None


def test_derive_canonical_metrics_reads_nested_data_raw_fields():
    m = derive_canonical_metrics(
        {
            "data": {
                "raw": {
                    "price": "£150,000",
                    "rent_pcm": "£1,250 pcm",
                }
            }
        }
    )
    assert m["price"] == 150000.0
    assert m["rent_monthly"] == 1250.0
    assert round(float(m["yield_percent"]), 2) == 10.0
