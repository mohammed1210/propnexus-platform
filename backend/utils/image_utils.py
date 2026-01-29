from __future__ import annotations

import json
import os
import re
from typing import Any, Iterable, List
from urllib.parse import urljoin, urlparse, urlunparse

_ALLOWED_IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp")


def normalize_image_url(u: Any, *, base_url: str | None = None) -> str | None:
    if not isinstance(u, str):
        return None
    s = u.strip()
    if not s:
        return None

    if s.startswith("//"):
        s = "https:" + s
    elif base_url and s.startswith("/"):
        s = urljoin(base_url, s)

    try:
        p = urlparse(s)
    except Exception:
        return None

    if p.scheme not in ("http", "https") or not p.netloc:
        return None

    # Strip fragment always; fragment is never required for fetching images.
    p = p._replace(fragment="")
    return urlunparse(p)


def strip_query(u: str) -> str:
    try:
        p = urlparse(u)
    except Exception:
        return u
    return urlunparse(p._replace(query="", fragment=""))


_FLOORPLAN_MARKERS = (
    "floorplan",
    "floor-plan",
    "floor_plan",
    "plan",
    "epc",
    "energy-performance",
)


def looks_like_floorplan(u: str) -> bool:
    s = (u or "").lower()
    return any(m in s for m in _FLOORPLAN_MARKERS)


def _resolution_score(u: str) -> int:
    """Heuristic score based on URL patterns that embed dimensions."""
    try:
        p = urlparse(u)
    except Exception:
        return 0

    host = (p.netloc or "").lower()
    path = p.path or ""

    # Zoopla format: /u/<w>/<h>/...ext
    if "zoocdn" in host:
        m = re.search(r"/u/(?P<w>\d{2,5})/(?P<h>\d{2,5})/", path)
        if m:
            try:
                return int(m.group("w")) * int(m.group("h"))
            except Exception:
                return 0

    # Common: ...-1024x768.jpg
    m = re.search(r"-(?P<w>\d{2,5})x(?P<h>\d{2,5})(?=\.(?:jpe?g|png|webp)$)", path, re.I)
    if m:
        try:
            return int(m.group("w")) * int(m.group("h"))
        except Exception:
            return 0

    # Rightmove: _max_#### tokens
    m = re.search(r"_max_(?P<w>\d{2,5})", path, re.I)
    if m:
        try:
            w = int(m.group("w"))
            return w * w
        except Exception:
            return 0

    return 0


def dedupe_image_urls(urls: Iterable[Any], *, base_url: str | None = None) -> List[str]:
    """Normalize + dedupe image URLs.

    - Normalizes protocol-relative URLs
    - Strips query params for dedupe stability
    - Dedupes by (host+path) and also by basename
    - Prefers higher-resolution variants when duplicates exist
    - Preserves first-seen ordering of distinct images
    """

    best_by_key: dict[str, tuple[int, int, str]] = {}
    first_seen: dict[str, int] = {}

    def _key_for(u: str) -> tuple[str, str]:
        p = urlparse(u)
        host = (p.netloc or "").lower()
        path = (p.path or "").lower()
        basename = os.path.basename(path)
        return f"{host}{path}", f"{host}/{basename}" if basename else f"{host}{path}"

    for idx, raw in enumerate(list(urls or [])):
        nu = normalize_image_url(raw, base_url=base_url)
        if not nu:
            continue

        # Only keep plausible image extensions.
        try:
            path = urlparse(nu).path.lower()
        except Exception:
            continue
        if not path.endswith(_ALLOWED_IMAGE_EXTS):
            continue

        # Strip query/fragment for stable dedupe (keep a fetchable URL).
        stable = strip_query(nu)

        k1, k2 = _key_for(stable)
        score = _resolution_score(stable)

        # Track first seen ordering by the primary key.
        if k1 not in first_seen:
            first_seen[k1] = idx

        # Compete by both keys; whichever wins becomes the canonical URL.
        for k in (k1, k2):
            existing = best_by_key.get(k)
            if existing is None:
                best_by_key[k] = (score, idx, stable)
                continue
            best_score, best_idx, best_url = existing
            if score > best_score or (score == best_score and idx < best_idx):
                best_by_key[k] = (score, idx, stable)
            else:
                best_by_key[k] = (best_score, best_idx, best_url)

    ordered = sorted(first_seen.items(), key=lambda kv: kv[1])
    out: list[str] = []
    seen_urls: set[str] = set()
    for k1, _ in ordered:
        cand = best_by_key.get(k1)
        if not cand:
            continue
        u = cand[2]
        if u in seen_urls:
            continue
        seen_urls.add(u)
        out.append(u)

    return out


def pick_cover_image(image_urls: Iterable[str]) -> str | None:
    urls = [u for u in (image_urls or []) if isinstance(u, str) and u.strip()]
    if not urls:
        return None

    non_floorplans = [u for u in urls if not looks_like_floorplan(u)]
    candidates = non_floorplans or urls

    # Prefer highest resolution; tie-break by first appearance.
    best = None
    best_score = -1
    for idx, u in enumerate(candidates):
        s = _resolution_score(u)
        if s > best_score:
            best = u
            best_score = s
        elif s == best_score and best is None:
            best = u

    return best or candidates[0]


def extract_image_urls_from_ld_json(html: str, *, base_url: str) -> List[str]:
    """Extract schema.org image arrays from application/ld+json blocks."""

    if not html:
        return []

    out: list[str] = []

    # Very small/defensive regex: we don't want BeautifulSoup dependency here.
    for m in re.finditer(
        r"<script[^>]*type=\"application/ld\+json\"[^>]*>(?P<body>.*?)</script>",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        raw = (m.group("body") or "").strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue

        def _scan(obj: Any, depth: int = 0) -> None:
            if depth > 12:
                return
            if isinstance(obj, str):
                nu = normalize_image_url(obj, base_url=base_url)
                if nu:
                    out.append(nu)
                return
            if isinstance(obj, list):
                for v in obj:
                    _scan(v, depth + 1)
                return
            if isinstance(obj, dict):
                if "image" in obj:
                    _scan(obj.get("image"), depth + 1)
                for v in obj.values():
                    _scan(v, depth + 1)

        _scan(data)

    return dedupe_image_urls(out, base_url=base_url)


def extract_next_data_json(html: str) -> dict[str, Any] | None:
    """Extract Next.js __NEXT_DATA__ from HTML (script id=__NEXT_DATA__)."""

    if not html:
        return None

    # Primary: id=__NEXT_DATA__
    m = re.search(
        r"<script[^>]*id=\"__NEXT_DATA__\"[^>]*>(?P<json>.*?)</script>",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if m:
        raw = (m.group("json") or "").strip()
        if raw:
            try:
                obj = json.loads(raw)
                if isinstance(obj, dict):
                    return obj
            except Exception:
                pass

    # Fallback: inline assignment
    m2 = re.search(
        r"(?:window\.|self\.)?__NEXT_DATA__\s*=\s*(?P<json>\{.*?\})\s*;\s*</script>",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if m2:
        raw = (m2.group("json") or "").strip()
        if raw:
            try:
                obj = json.loads(raw)
                if isinstance(obj, dict):
                    return obj
            except Exception:
                pass

    return None


def extract_image_urls_from_next_data(next_data: dict[str, Any], *, base_url: str) -> List[str]:
    """Best-effort scan for image URLs inside __NEXT_DATA__ payload."""

    if not isinstance(next_data, dict):
        return []

    out: list[str] = []

    def _scan(obj: Any, depth: int = 0) -> None:
        if depth > 14:
            return
        if isinstance(obj, str):
            s = obj.strip()
            if not s:
                return
            sl = s.lower()
            if any(sl.endswith(ext) for ext in _ALLOWED_IMAGE_EXTS) and (
                sl.startswith("http") or sl.startswith("//")
            ):
                nu = normalize_image_url(s, base_url=base_url)
                if nu:
                    out.append(nu)
            return
        if isinstance(obj, list):
            for v in obj:
                _scan(v, depth + 1)
            return
        if isinstance(obj, dict):
            for k, v in obj.items():
                kl = str(k).lower()
                if "image" in kl or kl in ("url", "src", "original", "full", "large"):
                    _scan(v, depth + 1)
                else:
                    _scan(v, depth + 1)

    _scan(next_data)
    return dedupe_image_urls(out, base_url=base_url)
