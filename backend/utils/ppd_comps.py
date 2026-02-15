from __future__ import annotations

from statistics import median
from typing import Any, Dict, List, Optional

from backend.utils.enrichment_store import safe_select_ppd_sales


def _outward_code(postcode: str | None) -> str | None:
    if not postcode or not isinstance(postcode, str):
        return None
    pc = postcode.strip().upper()
    if not pc:
        return None
    parts = [p for p in pc.split(" ") if p]
    return parts[0] if parts else None


def get_sold_comps_summary(
    sb: Any,
    *,
    postcode: str | None,
    limit: int = 20,
) -> Dict[str, Any]:
    """Return a compact summary object suitable for embedding in property responses."""

    outward = _outward_code(postcode)
    if not outward:
        return {"count": 0, "median_price": None, "items": []}

    rows = safe_select_ppd_sales(sb, postcode_prefix=outward, limit=limit)
    prices: List[int] = []
    items: List[Dict[str, Any]] = []

    for r in rows:
        if not isinstance(r, dict):
            continue
        p = r.get("price")
        try:
            pi = int(p)
        except Exception:
            pi = 0
        if pi > 0:
            prices.append(pi)
        items.append(
            {
                "price": pi if pi > 0 else None,
                "date": r.get("date_of_transfer"),
                "postcode": r.get("postcode"),
                "property_type": r.get("property_type"),
                "tenure": r.get("tenure"),
                "new_build": r.get("new_build"),
            }
        )

    med: Optional[float] = None
    if prices:
        try:
            med = float(median(prices))
        except Exception:
            med = None

    return {
        "count": len(items),
        "median_price": round(med, 0) if isinstance(med, (int, float)) else None,
        "items": items,
        "match": "outward_code",
        "outward_code": outward,
        "source": "land-registry-ppd",
    }
