import asyncio
import inspect
import os
import random
import re
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse

import aiohttp

TARGET_CITIES = [
    "London",
    "Birmingham",
    "Manchester",
    "Leeds",
    "Liverpool",
    "Sheffield",
    "Nottingham",
    "Leicester",
    "Bristol",
    "Cardiff",
    "Newcastle",
    "Glasgow",
    "Edinburgh",
]


def normalize_image_urls(urls: list[str]) -> list[str]:
    """Normalize a list of image URLs.

        - Drops empty/whitespace entries
        - Normalizes protocol-relative URLs (//...) to https://...
        - Ensures returned URLs are absolute http/https URLs
        - Aggressively filters out non-listing assets (logos, SVGs, Next.js static assets)
        - Deduplicates and prefers highest-resolution variants when duplicates exist
            (e.g. Zoopla u/1024/768 over u/480/360)
        - Strips Zoopla ':p' suffix variants when both exist (keeps the clean URL)

    Note: callers should pre-resolve relative paths (e.g. via urljoin(detail_url, u))
    before passing them here.
    """

    if not urls:
        return []

    _allowed_exts = (".jpg", ".jpeg", ".png", ".webp")
    _excluded_substrings = (
        "zoopla_static_agent_logo",
        "error-image",
        "_next/static",
    )

    def _strip_zoopla_p_suffix(s: str) -> str:
        # Zoopla sometimes returns URLs like `...jpg:p`.
        return re.sub(r":p(?=\?|$)", "", s)

    def _looks_like_photo_url(p) -> bool:
        host = (p.netloc or "").lower()
        path = (p.path or "").lower()
        full = (p.geturl() or "").lower()

        # Quick global excludes.
        if ".svg" in full or path.endswith(".svg"):
            return False
        if any(x in full for x in _excluded_substrings):
            return False

        # Must be an image extension.
        if not path.endswith(_allowed_exts):
            return False

        # Zoopla photos live on Zoopla CDN hosts under *.zoocdn.com.
        # Keep this broader than just lid.zoocdn.com to avoid missing gallery
        # images when Zoopla changes subdomains.
        if host.endswith("zoocdn.com"):
            return True

        # OnTheMarket listing photos are on media.onthemarket.com under /properties/.
        if host == "media.onthemarket.com":
            if "/properties/" not in path:
                return False
            # Drop agent/company logos and non-photo documents (EPCs/floorplans).
            if "/agents/" in path or "/companies/" in path or "logo" in path:
                return False
            if "epc" in path or "floorplan" in path:
                return False
            return True

        # Rightmove listing photos generally come from media.rightmove.co.uk and include _IMG_.
        if host == "media.rightmove.co.uk":
            if any(x in path for x in ("brand_logo", "/assets/", "/customer/")):
                return False
            if any(x in path for x in ("industry-affiliation", "_flp_", "_epc_")):
                return False
            return "_img_" in path

        return False

    def _resolution_score(p) -> int:
        host = (p.netloc or "").lower()
        path = p.path or ""

        # Zoopla format: /u/<w>/<h>/...ext
        if "lid.zoocdn.com" in host:
            m = re.search(r"/u/(?P<w>\d{2,5})/(?P<h>\d{2,5})/", path)
            if m:
                try:
                    return int(m.group("w")) * int(m.group("h"))
                except Exception:
                    return 0

        # OTM format: ...-1024x1024.webp
        m = re.search(r"-(?P<w>\d{2,5})x(?P<h>\d{2,5})(?=\.(?:jpe?g|png|webp)$)", path, re.I)
        if m:
            try:
                return int(m.group("w")) * int(m.group("h"))
            except Exception:
                return 0

        # Rightmove sometimes uses _max_#### tokens.
        m = re.search(r"_max_(?P<w>\d{2,5})", path, re.I)
        if m:
            try:
                w = int(m.group("w"))
                return w * w
            except Exception:
                return 0

        return 0

    def _canonical_key(p) -> str:
        host = (p.netloc or "").lower()
        path = p.path or ""

        if "lid.zoocdn.com" in host:
            # Deduplicate across size variants by the hashed filename.
            filename = (path.rsplit("/", 1)[-1] or "").lower()
            filename = re.sub(r"\.(?:jpe?g|png|webp)$", "", filename, flags=re.I)
            return f"{host}/{filename}"

        if host == "media.onthemarket.com":
            # Deduplicate across size variants by stripping '-<w>x<h>' before extension.
            p2 = re.sub(
                r"-(\d{2,5})x(\d{2,5})(?=\.(?:jpe?g|png|webp)$)",
                "",
                path,
                flags=re.IGNORECASE,
            )
            return f"{host}{p2.lower()}"

        if host == "media.rightmove.co.uk":
            # Deduplicate across max-size variants.
            p2 = re.sub(
                r"_max_[^./]+(?=\.(?:jpe?g|png|webp)$)",
                "",
                path,
                flags=re.IGNORECASE,
            )
            return f"{host}{p2.lower()}"

        return f"{host}{path.lower()}"

    best_by_key: dict[str, tuple[int, int, str]] = {}
    first_index: dict[str, int] = {}

    for idx, u in enumerate(urls):
        if not isinstance(u, str):
            continue
        s = u.strip()
        if not s:
            continue
        if s.startswith("//"):
            s = "https:" + s

        # Strip Zoopla ':p' variants early so extension checks work.
        s = _strip_zoopla_p_suffix(s)

        try:
            p = urlparse(s)
        except Exception:
            continue

        if p.scheme not in ("http", "https") or not p.netloc:
            continue
        if not _looks_like_photo_url(p):
            continue

        key = _canonical_key(p)
        score = _resolution_score(p)

        if key not in first_index:
            first_index[key] = idx

        existing = best_by_key.get(key)
        if existing is None:
            best_by_key[key] = (score, idx, s)
            continue

        best_score, best_idx, best_url = existing
        # Prefer higher resolution; if tied, prefer earlier occurrence.
        if score > best_score or (score == best_score and idx < best_idx):
            best_by_key[key] = (score, idx, s)
        else:
            best_by_key[key] = (best_score, best_idx, best_url)

    # Preserve the original order of distinct images (first time we saw each image key).
    ordered_keys = sorted(first_index.items(), key=lambda kv: kv[1])
    return [best_by_key[k][2] for k, _ in ordered_keys if k in best_by_key]


try:
    from supabase import Client, create_client
except ImportError:
    Client = object  # type: ignore

    def create_client(*args, **kwargs):
        return None


# ============================================================
# Supabase client (scraper writes)
# ============================================================

supabase_url = os.getenv("SUPABASE_URL")
# Use the service role key for server-side writes from scrapers
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Only create client if both URL and key are available.
# Type is intentionally loose here because `Client` may be a runtime fallback
# when the optional `supabase` dependency isn't installed in certain envs/CI.
supabase: Any = None
if supabase_url and supabase_key:
    try:
        supabase = create_client(supabase_url, supabase_key)
    except Exception:
        supabase = None


async def insert_property_to_supabase(property_data: Dict[str, Any]) -> None:
    if not supabase:
        print("⚠️ Supabase client not configured")
        return

    data = {
        "title": property_data.get("title"),
        "location": property_data.get("location"),
        "price": property_data.get("price"),
        "yield_percent": property_data.get("yield_percent"),
        "roi_percent": property_data.get("roi_percent"),
        "bmv": property_data.get("bmv"),
        "imageurl": property_data.get("image_url"),
        "description": property_data.get("description"),
        "source": property_data.get("source"),
    }
    supabase.table("properties").insert(data).execute()


# ============================================================
# Smart ScraperAPI mode configuration
# ============================================================

CAPTCHA_KEYWORDS = ["captcha", "access denied", "unusual traffic", "bot detection", "robot"]


def _get_scraper_mode() -> str:
    """Get current scraper mode from environment"""
    return os.getenv("SCRAPER_MODE", "direct").lower().strip()


def _get_scraperapi_key() -> str:
    """Get ScraperAPI key from environment"""
    return os.getenv("SCRAPERAPI_KEY", "").strip()


def build_scraperapi_url(url: str, scraperapi_key: str, render: bool = False) -> str:
    """
    Build a ScraperAPI proxy URL.
    Keeping this helper central makes the tests and scrapers consistent.
    """
    # NOTE: Keep this helper central and backwards compatible.
    # ScraperAPI supports a number of optional query parameters; we only include
    # those we explicitly opt into.
    base = f"https://api.scraperapi.com/?api_key={scraperapi_key}&url={url}"

    # Defaults for UK portals.
    country_code = (os.getenv("SCRAPERAPI_COUNTRY_CODE") or "gb").strip() or "gb"
    keep_headers_env = (os.getenv("SCRAPERAPI_KEEP_HEADERS") or "true").strip().lower()
    keep_headers = keep_headers_env in ("1", "true", "yes")
    base += f"&country_code={country_code}"
    base += f"&keep_headers={'true' if keep_headers else 'false'}"

    # Optional paid proxy pools.
    premium_env = (os.getenv("SCRAPERAPI_PREMIUM") or "").strip().lower()
    ultra_env = (os.getenv("SCRAPERAPI_ULTRA_PREMIUM") or "").strip().lower()
    if premium_env in ("1", "true", "yes"):
        base += "&premium=true"
    if ultra_env in ("1", "true", "yes"):
        base += "&ultra_premium=true"

    if render:
        base += "&render=true&device_type=desktop"

    session_fixed = (os.getenv("SCRAPERAPI_SESSION_NUMBER") or "").strip()
    session_random = (os.getenv("SCRAPERAPI_SESSION_RANDOM") or "").strip().lower() in (
        "1",
        "true",
        "yes",
    )
    if session_fixed:
        base += f"&session_number={session_fixed}"
    elif session_random:
        base += f"&session_number={random.randint(1, 999999)}"

    return base


# ============================================================
# Response sanity checks (blocked / partial pages)
# ============================================================


_BLOCK_KEYWORDS = (
    "captcha",
    "unusual traffic",
    "enable javascript",
    "access denied",
    "blocked",
    "robot",
    "bot detection",
    "are you a human",
)

_CONSENT_KEYWORDS = (
    "consent",
    "cookie",
    "didomi",
    "onetrust",
    "privacy",
    "cmp",
    "sp-message",
)

_BLOCKED_TITLE_KEYWORDS = (
    "access denied",
    "blocked",
    "robot",
    "captcha",
)


def detect_blocked_or_partial(
    html: Optional[str],
    status: Optional[int],
    *,
    min_html_bytes: int = 30_000,
) -> str | None:
    """Return a reason string if the response looks blocked/partial."""

    if status in (401, 403, 429, 503):
        return f"http_{status}"

    if not html or not isinstance(html, str):
        return "empty_body"

    s = html.strip()
    if not s:
        return "empty_body"

    lowered = s.lower()
    if any(k in lowered for k in _BLOCK_KEYWORDS):
        return "block_keyword"
    if any(k in lowered for k in _CONSENT_KEYWORDS):
        # Consent walls frequently hide content; treat as partial so we can
        # retry with JS render/premium pools.
        return "consent_wall"

    # Payload size heuristic: most UK portal detail pages are much larger.
    if len(s.encode("utf-8", errors="ignore")) < int(min_html_bytes or 0):
        # Avoid false positives for minimal but valid HTML.
        if not is_valid_html(s):
            return "small_payload_invalid"
        return "small_payload"

    # Title-based heuristics.
    try:
        m = re.search(r"<title[^>]*>(?P<t>.*?)</title>", s, flags=re.I | re.S)
        if m:
            t = re.sub(r"\s+", " ", (m.group("t") or "")).strip().lower()
            if t and any(k in t for k in _BLOCKED_TITLE_KEYWORDS):
                return "blocked_title"
    except Exception:
        pass

    return None


def detect_blocked_or_partial_explain(
    html: Optional[str],
    status: Optional[int],
    *,
    min_html_bytes: int = 30_000,
) -> Tuple[str | None, Dict[str, Any]]:
    """Like detect_blocked_or_partial(), but returns extra metadata.

    This is intentionally additive so existing callers can keep using
    detect_blocked_or_partial() unchanged.

    Returns:
        (reason, meta)
        - reason: same reason string as detect_blocked_or_partial() or None
        - meta: may include keys like 'block_keyword' or 'title_keyword'
    """

    meta: Dict[str, Any] = {}

    if status in (401, 403, 429, 503):
        return f"http_{status}", meta

    if not html or not isinstance(html, str):
        return "empty_body", meta

    s = html.strip()
    if not s:
        return "empty_body", meta

    lowered = s.lower()
    for k in _BLOCK_KEYWORDS:
        if k in lowered:
            meta["block_keyword"] = k
            return "block_keyword", meta

    for k in _CONSENT_KEYWORDS:
        if k in lowered:
            return "consent_wall", meta

    if len(s.encode("utf-8", errors="ignore")) < int(min_html_bytes or 0):
        if not is_valid_html(s):
            return "small_payload_invalid", meta
        return "small_payload", meta

    try:
        m = re.search(r"<title[^>]*>(?P<t>.*?)</title>", s, flags=re.I | re.S)
        if m:
            t = re.sub(r"\s+", " ", (m.group("t") or "")).strip().lower()
            if t:
                for k in _BLOCKED_TITLE_KEYWORDS:
                    if k in t:
                        meta["title_keyword"] = k
                        return "blocked_title", meta
    except Exception:
        pass

    return None, meta


def build_scraperapi_url_detail(
    url: str,
    *,
    scraperapi_key: str,
    render: bool = True,
    premium: bool | None = None,
    ultra_premium: bool | None = None,
    country_code: str = "gb",
    keep_headers: bool = True,
) -> str:
    """Detail-page ScraperAPI URL builder (explicit args).

    We keep this separate from build_scraperapi_url() so callers can control
    paid proxy pools without relying on global env.
    """

    base = f"https://api.scraperapi.com/?api_key={scraperapi_key}&url={url}"
    base += f"&country_code={(country_code or 'gb').strip() or 'gb'}"
    base += f"&keep_headers={'true' if keep_headers else 'false'}"
    if render:
        base += "&render=true&device_type=desktop"
    if premium is True:
        base += "&premium=true"
    if ultra_premium is True:
        base += "&ultra_premium=true"

    session_fixed = (os.getenv("SCRAPERAPI_SESSION_NUMBER") or "").strip()
    session_random = (os.getenv("SCRAPERAPI_SESSION_RANDOM") or "").strip().lower() in (
        "1",
        "true",
        "yes",
    )
    if session_fixed:
        base += f"&session_number={session_fixed}"
    elif session_random:
        base += f"&session_number={random.randint(1, 999999)}"
    return base


async def fetch_detail_html_with_diag(
    session: aiohttp.ClientSession,
    url: str,
    *,
    headers: dict,
    timeout: int = 45,
    country_code: str = "gb",
    prefer_render: bool = True,
    prefer_premium: bool = True,
    max_retries: int = 2,
) -> Tuple[Optional[int], Optional[str], Dict[str, Any]]:
    """Fetch a detail page with production-grade fallbacks.

    Strategy:
    - ScraperAPI render (optionally premium) is preferred for detail pages.
    - Detect blocked/partial payloads via detect_blocked_or_partial().
    - Retry a small number of times with jitter and escalating proxy pools.
    """

    scraperapi_key = _get_scraperapi_key()
    attempts: list[Dict[str, Any]] = []

    try:
        timeout_s = int((os.getenv("SCRAPER_DETAIL_TIMEOUT_SECONDS") or str(timeout)).strip())
    except Exception:
        timeout_s = int(timeout)

    async def _attempt(
        via: str, url_to_fetch: str, req_timeout: int
    ) -> Tuple[int | None, str | None]:
        try:
            req = session.get(url_to_fetch, headers=headers, timeout=req_timeout)
            req = await _maybe_await(req)
            async with req as resp:
                text = await _read_response_text(resp)
                status = int(getattr(resp, "status", 200))
                reason = detect_blocked_or_partial(text, status)
                attempts.append(
                    {
                        "via": via,
                        "status": status,
                        "bytes": len(text or ""),
                        "block_reason": reason,
                        "markers": _marker_summary(text or ""),
                        "snippet": _snippet_for_diag(text or "", max_chars=200 if reason else 0),
                    }
                )
                return status, text
        except Exception as e:
            attempts.append(
                {
                    "via": via,
                    "status": None,
                    "bytes": 0,
                    "block_reason": f"exception_{type(e).__name__}",
                    "markers": {},
                    "snippet": str(e),
                }
            )
            return None, None

    def _finalize(
        status: Optional[int], text: Optional[str], via: str
    ) -> Tuple[Optional[int], Optional[str], Dict[str, Any]]:
        reason = detect_blocked_or_partial(text, status)
        diag = {
            "via": via,
            "status": status,
            "bytes": len(text or ""),
            "block_reason": reason,
            "attempts": attempts,
        }
        return status, text, diag

    # If no ScraperAPI key is available, fall back to smart_fetch_html_with_diag (direct/smart mode).
    if not scraperapi_key:
        st, txt, diag = await smart_fetch_html_with_diag(session, url, headers, timeout=timeout_s)
        diag = {**(diag or {}), "block_reason": detect_blocked_or_partial(txt, st)}
        return st, txt, diag

    # Escalation plan for detail pages.
    # Prefer render=true first; if blocked/partial, retry with premium/ultra.
    plan: list[tuple[str, dict[str, Any], int]] = []
    if prefer_render:
        plan.append(
            (
                "scraperapi-render",
                {"render": True, "premium": False, "ultra": False},
                max(60, timeout_s),
            )
        )
        if prefer_premium:
            plan.append(
                (
                    "scraperapi-render-premium",
                    {"render": True, "premium": True, "ultra": False},
                    max(75, timeout_s),
                )
            )
            plan.append(
                (
                    "scraperapi-render-ultra",
                    {"render": True, "premium": True, "ultra": True},
                    max(90, timeout_s),
                )
            )
    else:
        plan.append(
            (
                "scraperapi-no-render",
                {"render": False, "premium": False, "ultra": False},
                max(45, timeout_s),
            )
        )
        plan.append(
            (
                "scraperapi-render",
                {"render": True, "premium": False, "ultra": False},
                max(60, timeout_s),
            )
        )

    # Also try a no-render pass at the end; some portals are more parseable without JS.
    plan.append(
        (
            "scraperapi-no-render-final",
            {"render": False, "premium": True, "ultra": False},
            max(60, timeout_s),
        )
    )

    for i, (via, opts, req_timeout) in enumerate(plan):
        proxy_url = build_scraperapi_url_detail(
            url,
            scraperapi_key=scraperapi_key,
            render=bool(opts.get("render")),
            premium=bool(opts.get("premium")),
            ultra_premium=bool(opts.get("ultra")),
            country_code=country_code,
            keep_headers=True,
        )
        status, text = await _attempt(via, proxy_url, req_timeout=req_timeout)
        reason = detect_blocked_or_partial(text, status)
        if not reason and is_valid_html(text):
            return _finalize(status, text, via)

        # If not blocked but HTML is valid, allow returning it (some pages are small).
        if reason in (None, "small_payload") and is_valid_html(text):
            return _finalize(status, text, via)

        # Respect max_retries with jitter for transient failures.
        if i < len(plan) - 1:
            try:
                await asyncio.sleep(random.uniform(0.4, 1.2))
            except Exception:
                pass

    # All attempts failed/blocked.
    last = attempts[-1] if attempts else {}
    return _finalize(last.get("status"), None, str(last.get("via") or "scraperapi"))


def _looks_blocked(html: str, status: int) -> bool:
    """Check if response indicates blocking or captcha."""
    if status in (403, 503):
        return True
    lowered = (html or "").lower()
    return any(k in lowered for k in CAPTCHA_KEYWORDS)


# ============================================================
# HTML validation (tests expect a lightweight validator)
# ============================================================

_HTML_RE = re.compile(r"<(html|body|head|div|span|p|a|script|style)\b", re.IGNORECASE)


def is_valid_html(html: Optional[str]) -> bool:
    """
    Lightweight HTML sanity check suitable for scrapers and tests.

    Tests expect common minimal HTML snippets like:
      '<html><body>Valid content</body></html>'
    to be treated as valid.
    """
    if not html or not isinstance(html, str):
        return False
    s = html.strip()
    if len(s) < 10:
        return False
    sl = s.lower()
    if "<html" in sl or "<body" in sl or "<!doctype" in sl:
        return True
    if _HTML_RE.search(s):
        return True
    return False


# Backward compatibility for existing scraper code
def _is_valid_html(html: str) -> bool:
    return is_valid_html(html)


# ============================================================
# Async helpers (important for pytest mocks)
# ============================================================


async def _maybe_await(obj: Any) -> Any:
    """If obj is awaitable (e.g. AsyncMock), await it; otherwise return it."""
    if inspect.isawaitable(obj):
        return await obj
    return obj


async def _read_response_text(resp: Any) -> str:
    """
    Supports both aiohttp response objects and test doubles.

    - aiohttp: await resp.text()
    - mocks: resp.text might be AsyncMock or a plain string
    """
    try:
        t = getattr(resp, "text", None)
        if callable(t):
            out = t()
            out = await _maybe_await(out)
            return out if isinstance(out, str) else str(out)
        if isinstance(t, str):
            return t
    except Exception:
        pass
    return ""


# ============================================================
# smart_fetch_html (fixes failing observability tests)
# ============================================================


async def smart_fetch_html(
    session: aiohttp.ClientSession,
    url: str,
    headers: dict,
    timeout: int = 30,
) -> Optional[str]:
    """
    Smart fetch with progressive fallback strategy.

    Behavior based on SCRAPER_MODE:
    - 'direct': Try direct fetch only (current behavior)
    - 'scraperapi': Use ScraperAPI with render only (current behavior)
    - 'smart': Progressive fallback:
        1. Try direct fetch first
        2. If blocked/invalid, try ScraperAPI without render (cheap)
        3. If still blocked, try ScraperAPI with render (expensive)

    Returns:
        HTML content or None if all methods fail
    """

    scraper_mode = _get_scraper_mode()
    scraperapi_key = _get_scraperapi_key()

    # Align request timeouts across ingest/scraper layers.
    # If SCRAPER_TIMEOUT_SECONDS is set higher (e.g. 120), avoid hidden 45s caps.
    try:
        timeout_s = int((os.getenv("SCRAPER_TIMEOUT_SECONDS") or str(timeout)).strip())
    except Exception:
        timeout_s = int(timeout)

    async def _get(url_to_fetch: str, req_timeout: int) -> tuple[int, str]:
        """
        Works with real aiohttp AND pytest AsyncMock session.get.

        - If session.get returns an awaitable -> await it
        - Then treat it as an async context manager (aiohttp style)
        """
        req = session.get(url_to_fetch, headers=headers, timeout=req_timeout)
        req = await _maybe_await(req)
        async with req as resp:
            text = await _read_response_text(resp)
            status = getattr(resp, "status", 200)
            return int(status), text

    # ------------------------------------------------------------
    # Mode: scraperapi-only
    # ------------------------------------------------------------
    if scraper_mode == "scraperapi":
        if not scraperapi_key:
            print("⚠️ SCRAPER_MODE=scraperapi but SCRAPERAPI_KEY not set")
            return None

        proxy_url = build_scraperapi_url(url, scraperapi_key=scraperapi_key, render=True)
        try:
            status, text = await _get(proxy_url, req_timeout=max(60, timeout_s))
            if _looks_blocked(text, status):
                return None
            return text if is_valid_html(text) else None
        except Exception as e:
            print(f"⚠️ ScraperAPI fetch failed: {e}")
            return None

    # ------------------------------------------------------------
    # Mode: smart fallback
    # ------------------------------------------------------------
    if scraper_mode == "smart":
        # Step 1: Try direct fetch
        try:
            status, text = await _get(url, req_timeout=timeout_s)
            if (not _looks_blocked(text, status)) and is_valid_html(text):
                return text
            print("ℹ️ Direct fetch blocked or invalid, trying ScraperAPI...")
        except Exception as e:
            print(f"ℹ️ Direct fetch failed ({e}), trying ScraperAPI...")

        if not scraperapi_key:
            print("⚠️ ScraperAPI key not configured, cannot fallback")
            return None

        # Step 2: ScraperAPI without render
        try:
            proxy_url = build_scraperapi_url(url, scraperapi_key=scraperapi_key, render=False)
            status, text = await _get(proxy_url, req_timeout=max(45, timeout_s))
            if (not _looks_blocked(text, status)) and is_valid_html(text):
                print("✅ ScraperAPI (no-render) successful")
                return text
            print("ℹ️ ScraperAPI (no-render) blocked/invalid, trying with render...")
        except Exception as e:
            print(f"ℹ️ ScraperAPI (no-render) failed ({e}), trying with render...")

        # Step 3: ScraperAPI with render
        try:
            proxy_url = build_scraperapi_url(url, scraperapi_key=scraperapi_key, render=True)
            status, text = await _get(proxy_url, req_timeout=max(60, timeout_s))
            if _looks_blocked(text, status):
                print("⚠️ ScraperAPI (with render) still blocked")
                return None
            return text if is_valid_html(text) else None
        except Exception as e:
            print(f"⚠️ ScraperAPI (with render) failed: {e}")
            return None

    # ------------------------------------------------------------
    # Mode: direct (default)
    # ------------------------------------------------------------
    try:
        status, text = await _get(url, req_timeout=timeout_s)

        # If blocked, optionally fallback to ScraperAPI render (legacy behavior)
        if _looks_blocked(text, status) and scraperapi_key:
            print("ℹ️ Direct mode blocked, falling back to ScraperAPI...")
            proxy_url = build_scraperapi_url(url, scraperapi_key=scraperapi_key, render=True)
            p_status, p_text = await _get(proxy_url, req_timeout=60)
            if _looks_blocked(p_text, p_status):
                return None
            return p_text if is_valid_html(p_text) else None

        return (
            text if is_valid_html(text) else text
        )  # preserve legacy: return raw text if direct works
    except Exception as e:
        if scraperapi_key:
            print(f"ℹ️ Direct mode exception ({e}), falling back to ScraperAPI...")
            try:
                proxy_url = build_scraperapi_url(url, scraperapi_key=scraperapi_key, render=True)
                p_status, p_text = await _get(proxy_url, req_timeout=60)
                if _looks_blocked(p_text, p_status):
                    return None
                return p_text if is_valid_html(p_text) else None
            except Exception:
                return None
        return None


def _marker_summary(text: str) -> Dict[str, bool]:
    lowered = (text or "").lower()
    return {
        "__NEXT_DATA__": "__next_data__" in lowered,
        "__PRELOADED_STATE__": "__preloaded_state__" in lowered,
        "propertyCard": "propertycard" in lowered,
        "consent": any(
            k in lowered
            for k in (
                "consent",
                "consent-manager",
                "sp-message",
                "didomi",
                "privacy",
                "cmp",
            )
        ),
        "captcha": any(k in lowered for k in CAPTCHA_KEYWORDS),
        "cdn-cgi": "cdn-cgi" in lowered,
    }


def _snippet_for_diag(text: str, *, max_chars: int = 200) -> str:
    s = (text or "").strip().replace("\n", " ").replace("\r", " ")
    s = re.sub(r"\s+", " ", s)
    return s[:max_chars]


async def smart_fetch_html_with_diag(
    session: aiohttp.ClientSession,
    url: str,
    headers: dict,
    timeout: int = 30,
) -> Tuple[Optional[int], Optional[str], Dict[str, Any]]:
    """Smart fetch with diagnostics.

    This is a backward-safe companion to smart_fetch_html(). It follows the same
    SCRAPER_MODE behavior but returns (status, text, diag) so callers can log
    actionable failures (e.g. 5xx error payloads from ScraperAPI).

    Returns:
        (status, text, diag)
        - status: HTTP status code when available
        - text: response body (HTML or error payload)
        - diag: dict with keys: via, status, bytes, markers, snippet, attempts
    """

    scraper_mode = _get_scraper_mode()
    scraperapi_key = _get_scraperapi_key()

    try:
        timeout_s = int((os.getenv("SCRAPER_TIMEOUT_SECONDS") or str(timeout)).strip())
    except Exception:
        timeout_s = int(timeout)

    attempts: list[Dict[str, Any]] = []

    async def _attempt(via: str, url_to_fetch: str, req_timeout: int) -> Tuple[int, str]:
        try:
            req = session.get(url_to_fetch, headers=headers, timeout=req_timeout)
            req = await _maybe_await(req)
            async with req as resp:
                text = await _read_response_text(resp)
                status = int(getattr(resp, "status", 200))
                attempts.append(
                    {
                        "via": via,
                        "status": status,
                        "bytes": len(text or ""),
                        "markers": _marker_summary(text or ""),
                        "snippet": (
                            _snippet_for_diag(text or "", max_chars=200 if status >= 400 else 0)
                            if (status >= 400 or not (text or "").strip())
                            else ""
                        ),
                    }
                )
                return status, text
        except Exception as e:
            attempts.append(
                {
                    "via": via,
                    "status": None,
                    "bytes": 0,
                    "markers": {},
                    "snippet": f"exception={type(e).__name__}: {e}",
                }
            )
            raise

    def _finalize(
        status: Optional[int], text: Optional[str], via: str
    ) -> Tuple[Optional[int], Optional[str], Dict[str, Any]]:
        last_text = text or ""
        diag = {
            "via": via,
            "status": status,
            "bytes": len(last_text),
            "markers": _marker_summary(last_text),
            "snippet": (
                _snippet_for_diag(last_text, max_chars=200)
                if (status is None or status >= 400 or not last_text.strip())
                else ""
            ),
            "attempts": attempts,
        }
        return status, text, diag

    # ------------------------------------------------------------
    # Mode: scraperapi-only
    # ------------------------------------------------------------
    if scraper_mode == "scraperapi":
        if not scraperapi_key:
            return _finalize(None, None, "scraperapi")
        proxy_url = build_scraperapi_url(url, scraperapi_key=scraperapi_key, render=True)
        try:
            status, text = await _attempt(
                "scraperapi-render", proxy_url, req_timeout=max(60, timeout_s)
            )
            if _looks_blocked(text, status):
                return _finalize(status, text, "scraperapi-render")
            return _finalize(status, text, "scraperapi-render")
        except Exception:
            return _finalize(None, None, "scraperapi-render")

    # ------------------------------------------------------------
    # Mode: smart fallback
    # ------------------------------------------------------------
    if scraper_mode == "smart":
        # Step 1: direct
        try:
            status, text = await _attempt("direct", url, req_timeout=timeout_s)
            if (not _looks_blocked(text, status)) and is_valid_html(text):
                return _finalize(status, text, "direct")
        except Exception:
            pass

        if not scraperapi_key:
            return _finalize(None, None, "direct")

        # Step 2: ScraperAPI no-render
        try:
            proxy_url = build_scraperapi_url(url, scraperapi_key=scraperapi_key, render=False)
            status, text = await _attempt(
                "scraperapi-no-render", proxy_url, req_timeout=max(45, timeout_s)
            )
            if (not _looks_blocked(text, status)) and is_valid_html(text):
                return _finalize(status, text, "scraperapi-no-render")
        except Exception:
            pass

        # Step 3: ScraperAPI render
        try:
            proxy_url = build_scraperapi_url(url, scraperapi_key=scraperapi_key, render=True)
            status, text = await _attempt(
                "scraperapi-render", proxy_url, req_timeout=max(60, timeout_s)
            )
            if _looks_blocked(text, status):
                return _finalize(status, text, "scraperapi-render")
            return _finalize(status, text if is_valid_html(text) else None, "scraperapi-render")
        except Exception:
            return _finalize(None, None, "scraperapi-render")

    # ------------------------------------------------------------
    # Mode: direct (default)
    # ------------------------------------------------------------
    try:
        status, text = await _attempt("direct", url, req_timeout=timeout_s)
        if _looks_blocked(text, status) and scraperapi_key:
            proxy_url = build_scraperapi_url(url, scraperapi_key=scraperapi_key, render=True)
            p_status, p_text = await _attempt(
                "scraperapi-render-fallback", proxy_url, req_timeout=60
            )
            if _looks_blocked(p_text, p_status):
                return _finalize(p_status, p_text, "scraperapi-render-fallback")
            return _finalize(
                p_status, p_text if is_valid_html(p_text) else None, "scraperapi-render-fallback"
            )

        return _finalize(status, text, "direct")
    except Exception:
        if scraperapi_key:
            try:
                proxy_url = build_scraperapi_url(url, scraperapi_key=scraperapi_key, render=True)
                p_status, p_text = await _attempt(
                    "scraperapi-render-exception-fallback", proxy_url, req_timeout=60
                )
                if _looks_blocked(p_text, p_status):
                    return _finalize(p_status, p_text, "scraperapi-render-exception-fallback")
                return _finalize(
                    p_status,
                    p_text if is_valid_html(p_text) else None,
                    "scraperapi-render-exception-fallback",
                )
            except Exception:
                return _finalize(None, None, "scraperapi-render-exception-fallback")

        return _finalize(None, None, "direct")
