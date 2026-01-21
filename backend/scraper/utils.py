import inspect
import os
import random
import re
from typing import Any, Dict, Optional, Tuple

import aiohttp

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

# Only create client if both URL and key are available
supabase: Optional[Client] = None
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
    base = (
        f"https://api.scraperapi.com/?api_key={scraperapi_key}"
        f"&url={url}"
        f"&country_code=gb"
        f"&keep_headers=true"
    )
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
