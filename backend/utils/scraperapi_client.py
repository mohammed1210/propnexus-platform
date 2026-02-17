import inspect
import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, Optional
from urllib.parse import urlencode

logger = logging.getLogger(__name__)

SCRAPERAPI_BASE = "https://api.scraperapi.com/"

_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)


def _extract_title(html: str) -> str:
    if not html:
        return ""
    m = _TITLE_RE.search(html)
    if not m:
        return ""
    return re.sub(r"\s+", " ", (m.group(1) or "").strip())[:200]


def _has_next_data(html: str) -> bool:
    return "__NEXT_DATA__" in (html or "")


@dataclass(frozen=True)
class ScraperAPIResult:
    status: int
    text: str
    proxy_url: str
    premium: bool
    ultra_premium: bool


def build_scraperapi_url(
    target_url: str,
    *,
    api_key: Optional[str] = None,
    country_code: str = "gb",
    render: bool = False,
    premium: bool = False,
    ultra_premium: bool = False,
    keep_headers: bool = True,
) -> str:
    key = (api_key if api_key is not None else os.getenv("SCRAPERAPI_KEY", "")).strip()
    if not key:
        return target_url

    params: Dict[str, Any] = {
        "api_key": key,
        "url": target_url,
        "country_code": country_code or "gb",
        "render": "true" if render else None,
        "premium": "true" if premium else None,
        "ultra_premium": "true" if ultra_premium else None,
        "keep_headers": "true" if keep_headers else None,
    }
    params = {k: v for k, v in params.items() if v is not None}
    if render:
        params["device_type"] = "desktop"

    return f"{SCRAPERAPI_BASE}?{urlencode(params)}"


async def fetch_via_scraperapi(
    session: Any,
    target_url: str,
    *,
    headers: Optional[Dict[str, str]] = None,
    premium: bool = False,
    ultra_premium: bool = False,
    country_code: str = "gb",
    render: bool = False,
    timeout_seconds: int = 120,
    debug_label: str = "",
) -> ScraperAPIResult:
    """Fetch a URL through ScraperAPI.

    Retry policy:
    - If `premium=True` and the response is 5xx or empty, retry once with `ultra_premium=True`.

    This wrapper is intentionally lightweight and works with both real aiohttp sessions
    and AsyncMock sessions used in unit tests (via `inspect.isawaitable`).
    """

    api_key = (os.getenv("SCRAPERAPI_KEY", "") or "").strip()
    if not api_key:
        return ScraperAPIResult(
            status=0,
            text="",
            proxy_url=target_url,
            premium=bool(premium),
            ultra_premium=bool(ultra_premium),
        )

    async def _do(p: bool, up: bool) -> ScraperAPIResult:
        proxy_url = build_scraperapi_url(
            target_url,
            api_key=api_key,
            country_code=country_code,
            render=render,
            premium=p,
            ultra_premium=up,
            keep_headers=True,
        )

        req = session.get(proxy_url, headers=headers or {}, timeout=timeout_seconds)
        if inspect.isawaitable(req):
            req = await req
        async with req as resp:
            text = await resp.text()
            status = int(getattr(resp, "status", 0) or 0)

        if debug_label:
            title = _extract_title(text)
            logger.debug(
                "[%s] Fetch via=scraperapi status=%s premium=%s ultra_premium=%s title=%r next_data=%s bytes=%s",
                debug_label,
                status,
                bool(p),
                bool(up),
                title,
                _has_next_data(text),
                len(text or ""),
            )

        return ScraperAPIResult(
            status=status,
            text=text or "",
            proxy_url=proxy_url,
            premium=bool(p),
            ultra_premium=bool(up),
        )

    first = await _do(bool(premium), bool(ultra_premium))
    failed = (first.status >= 500) or not (first.text or "").strip()

    if bool(premium) and (not bool(ultra_premium)) and failed:
        if debug_label:
            print(f"[{debug_label}] scraperapi premium retry -> ultra_premium")
        second = await _do(False, True)
        return second

    return first


async def fetch_json_via_scraperapi(
    session: Any,
    target_url: str,
    *,
    headers: Optional[Dict[str, str]] = None,
    premium: bool = False,
    ultra_premium: bool = False,
    country_code: str = "gb",
    render: bool = False,
    timeout_seconds: int = 120,
    debug_label: str = "",
) -> Any:
    result = await fetch_via_scraperapi(
        session,
        target_url,
        headers=headers,
        premium=premium,
        ultra_premium=ultra_premium,
        country_code=country_code,
        render=render,
        timeout_seconds=timeout_seconds,
        debug_label=debug_label,
    )
    try:
        return json.loads(result.text or "null")
    except Exception:
        return None
