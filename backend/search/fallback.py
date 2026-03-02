def broaden(filters: dict) -> tuple[dict, dict]:
    changes = {}
    f = filters.copy()

    # relax yield
    yield_filter = f.get("yield")
    if isinstance(yield_filter, dict):
        y = yield_filter.get("gte")
        if isinstance(y, (int, float)) and y >= 0.07:
            yield_filter["gte"] = 0.05
            changes["yield"] = "≥5%"

    # widen price
    price_filter = f.get("price")
    if isinstance(price_filter, dict):
        p = price_filter.get("lte")
        if isinstance(p, (int, float)):
            price_filter["lte"] = int(p * 1.1)
            changes["price"] = f"≤£{price_filter['lte']:,}"

    # drop least-selected facet
    if not changes and len(f) > 0:
        key = next(iter(f.keys()))
        f.pop(key)
        changes["dropped"] = key

    return f, changes
