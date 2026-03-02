def broaden(filters: dict) -> tuple[dict, dict]:
    changes = {}
    f = filters.copy()

    # relax yield
    if (y := f.get("yield", {}).get("gte")) and y >= 0.07:
        f["yield"]["gte"] = 0.05
        changes["yield"] = "≥5%"

    # widen price
    if p := f.get("price", {}).get("lte"):
        f["price"]["lte"] = int(p * 1.1)
        changes["price"] = f"≤£{f['price']['lte']:,}"

    # drop least-selected facet
    if not changes and len(f) > 0:
        key = next(iter(f.keys()))
        f.pop(key)
        changes["dropped"] = key

    return f, changes
