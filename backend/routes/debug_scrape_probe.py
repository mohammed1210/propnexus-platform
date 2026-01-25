from __future__ import annotations

import asyncio
import json
import os
import random
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException, Query

router = APIRouter(tags=["debug"])


def _require_admin(x_admin_token: str | None = None) -> None:
    """Reuse the same admin gate as /import/*.

    This endpoint can trigger outbound scraping requests, so it must be protected
    when IMPORT_ADMIN_TOKEN is configured.
    """

    required = os.getenv("IMPORT_ADMIN_TOKEN")
    if required and x_admin_token != required:
        raise HTTPException(status_code=401, detail="Admin token required")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _generic_blocked_markers(text: str) -> bool:
    lowered = (text or "").lower()
    markers = (
        "cloudflare",
        "just a moment",
        "checking your browser",
        "enable javascript",
        "verify you are human",
        "access denied",
        "unusual traffic",
        "captcha",
        "bot detection",
    )
    return any(m in lowered for m in markers)


def _safe_source_list(sources: Optional[str]) -> List[str]:
    allowed = ["zoopla", "rightmove", "onthemarket", "spareroom"]
    if not sources:
        return allowed

    requested = [s.strip().lower() for s in sources.split(",") if s.strip()]
    return [s for s in requested if s in allowed]


def _final_block_status(*, blocked_by_heuristic: bool, cards_found: int) -> tuple[bool, str]:
    """Decide final block status.

    Real signal beats heuristics: if we can parse cards, treat as not blocked.
    """

    if cards_found > 0:
        return False, "ok"
    if blocked_by_heuristic:
        return True, "blocked"
    return False, "ok"


async def _fetch_text(
    session: Any, url: str, *, headers: Dict[str, str], timeout_seconds: int
) -> tuple[int, str]:
    async with session.get(url, headers=headers, timeout=timeout_seconds) as resp:
        status = getattr(resp, "status", 0)
        text = await resp.text()
        return status, text


async def _probe_zoopla(
    session: Any, location: str, page: int, timeout_seconds: int
) -> Dict[str, Any]:
    from bs4 import BeautifulSoup

    from backend.scraper import zoopla_scraper as zp

    target_url = zp._build_search_url(location, page=page)

    mode = (os.getenv("SCRAPER_MODE") or "direct").lower()
    has_key = bool((os.getenv("SCRAPERAPI_KEY") or "").strip())
    proxy_used = mode == "scraperapi" and has_key

    headers = {"User-Agent": zp.USER_AGENT, "Accept-Language": "en-GB,en;q=0.9"}

    started = time.monotonic()
    try:
        fetch_url = zp.make_scraperapi_url(target_url, render=True) if proxy_used else target_url
        status, text = await _fetch_text(
            session, fetch_url, headers=headers, timeout_seconds=timeout_seconds
        )
    except asyncio.TimeoutError:
        return {
            "target_url": target_url,
            "proxy_used": proxy_used,
            "classification": "timeout",
            "elapsed_ms": int((time.monotonic() - started) * 1000),
        }

    initial_blocked = bool(zp._looks_blocked(text, status) or _generic_blocked_markers(text))
    initial_status = status
    initial_len = len(text or "")

    # Match scraper behavior: in direct mode, attempt ScraperAPI fallback when blocked.
    fallback_used = False
    if (not proxy_used) and has_key and initial_blocked:
        fallback_used = True
        try:
            proxy_url = zp.make_scraperapi_url(target_url, render=True)
            status, text = await _fetch_text(
                session, proxy_url, headers=headers, timeout_seconds=max(timeout_seconds, 60)
            )
        except Exception:
            # Keep the original blocked response
            status, text = initial_status, text

    blocked_by_heuristic = bool(zp._looks_blocked(text, status) or _generic_blocked_markers(text))
    soup = BeautifulSoup(text, "html.parser")
    cards = zp._collect_cards(soup)

    title_text = None
    try:
        title_text = soup.title.get_text(" ", strip=True) if soup.title else None
    except Exception:
        title_text = None

    meta_robots = None
    try:
        mr = soup.find("meta", attrs={"name": "robots"})
        if mr and mr.get("content"):
            meta_robots = str(mr.get("content"))
    except Exception:
        meta_robots = None

    # Additional signal: Zoopla detail links often exist even when card selectors break.
    try:
        detail_links = soup.select("a[href*='/for-sale/details/']")
        detail_links_found = len(detail_links)
    except Exception:
        detail_links_found = 0

    has_next_data_id = bool(soup.find("script", id="__NEXT_DATA__"))
    has_next_data_marker = "__NEXT_DATA__" in (text or "")

    # Zoopla frequently renders listings via embedded Next.js JSON rather than
    # stable, easily countable DOM cards. Mirror the scraper's embedded extraction
    # so the probe can distinguish "no results" from "parser mismatch".
    next_data = zp._extract_next_data(soup) or zp._extract_next_data_from_html(text)
    embedded_listings = (
        zp._find_zoopla_listings_in_next_data(next_data) if isinstance(next_data, dict) else []
    )
    embedded_count = len(embedded_listings) if isinstance(embedded_listings, list) else 0
    embedded_sample: Dict[str, Any] = {}
    embedded_sample_keys: List[str] = []
    if embedded_listings and isinstance(embedded_listings[0], dict):
        embedded_sample_keys = list(embedded_listings[0].keys())[:25]
        embedded_sample = {
            "listingId": embedded_listings[0].get("listingId")
            or embedded_listings[0].get("listing_id")
            or embedded_listings[0].get("id"),
            "title": embedded_listings[0].get("title")
            or embedded_listings[0].get("displayAddress")
            or embedded_listings[0].get("address"),
            "displayAddress": embedded_listings[0].get("displayAddress"),
            "price": embedded_listings[0].get("price") or embedded_listings[0].get("displayPrice"),
            "imageUrl": embedded_listings[0].get("imageUrl")
            or embedded_listings[0].get("image_url"),
            "url": embedded_listings[0].get("listingUrl") or embedded_listings[0].get("url"),
        }

    # Use whichever signal yields more results.
    items_found = max(len(cards), embedded_count, detail_links_found)

    blocked_final, classification = _final_block_status(
        blocked_by_heuristic=blocked_by_heuristic, cards_found=items_found
    )
    if classification == "ok" and items_found == 0:
        classification = "fetched_no_cards"
    if classification == "ok" and embedded_count > 0 and len(cards) == 0:
        classification = "parsed_embedded"
    if (
        classification == "ok"
        and detail_links_found > 0
        and len(cards) == 0
        and embedded_count == 0
    ):
        classification = "parsed_links_only"

    return {
        "target_url": target_url,
        "proxy_used": bool(proxy_used or fallback_used),
        "initial_http_status": initial_status,
        "initial_html_len": initial_len,
        "initial_blocked": initial_blocked,
        "proxy_fallback_used": fallback_used,
        "http_status": status,
        "html_len": len(text or ""),
        "cards_found": len(cards),
        "detail_links_found": detail_links_found,
        "embedded_listings_found": embedded_count,
        "embedded_listing_keys_sample": embedded_sample_keys,
        "embedded_listing_sample": embedded_sample,
        "has_next_data_id": has_next_data_id,
        "has_next_data_marker": has_next_data_marker,
        "title": title_text,
        "meta_robots": meta_robots,
        "blocked_by_heuristic": blocked_by_heuristic,
        "blocked": blocked_final,
        "classification": classification,
        "elapsed_ms": int((time.monotonic() - started) * 1000),
    }


async def _probe_rightmove(
    session: Any,
    location: str,
    page: int,
    timeout_seconds: int,
    *,
    include_escalation: bool,
) -> Dict[str, Any]:
    from bs4 import BeautifulSoup

    from backend.scraper import rightmove_scraper as rm

    mode = (os.getenv("SCRAPER_MODE") or "direct").lower()
    has_key = bool((os.getenv("SCRAPERAPI_KEY") or "").strip())

    # 1) Probe JSON API if we know a region identifier.
    api_probe: Dict[str, Any] = {"classification": "skipped"}
    region_id = rm._LOCATION_IDENTIFIER.get(location.lower())
    if region_id:
        api_started = time.monotonic()
        api_url = (
            f"{rm.RIGHTMOVE_API_BASE}?locationIdentifier={region_id}"
            "&numberOfPropertiesPerPage=24&sortType=2&index=0&channel=BUY"
        )
        api_headers = {
            "User-Agent": rm.USER_AGENT,
            "Accept": "application/json, text/plain, */*",
            "Referer": "https://www.rightmove.co.uk/",
        }

        try:
            proxy_used = mode == "scraperapi" and has_key
            fetch_url = rm.make_scraperapi_url(api_url, render=False) if proxy_used else api_url
            async with session.get(fetch_url, headers=api_headers, timeout=timeout_seconds) as resp:
                api_status = getattr(resp, "status", 0)
                raw = await resp.text()

            data: Any = raw
            try:
                data = json.loads(raw) if (raw or "").strip() else {}
            except Exception:
                data = raw

            # Match scraper behavior: in direct mode, retry through ScraperAPI on non-200.
            fallback_used = False
            if (not proxy_used) and has_key and api_status != 200:
                fallback_used = True
                proxy_url = rm.make_scraperapi_url(api_url, render=False)
                async with session.get(
                    proxy_url, headers=api_headers, timeout=timeout_seconds
                ) as p_resp:
                    api_status = getattr(p_resp, "status", 0)
                    raw = await p_resp.text()
                    try:
                        data = json.loads(raw) if (raw or "").strip() else {}
                    except Exception:
                        data = raw

            props = []
            if isinstance(data, dict):
                props = data.get("properties") or []

            blocked = bool(
                api_status in (403, 503)
                or (isinstance(data, str) and _generic_blocked_markers(data))
            )
            api_probe = {
                "target_url": api_url,
                "proxy_used": bool(proxy_used or fallback_used),
                "proxy_fallback_used": fallback_used,
                "http_status": api_status,
                "properties_found": len(props) if isinstance(props, list) else 0,
                "blocked": blocked,
                "classification": (
                    "blocked"
                    if blocked
                    else (
                        "parsed"
                        if isinstance(props, list) and len(props) > 0
                        else "fetched_no_results"
                    )
                ),
                "elapsed_ms": int((time.monotonic() - api_started) * 1000),
            }
        except asyncio.TimeoutError:
            api_probe = {
                "target_url": api_url,
                "proxy_used": mode == "scraperapi" and has_key,
                "classification": "timeout",
                "elapsed_ms": int((time.monotonic() - api_started) * 1000),
            }
        except Exception as e:
            api_probe = {
                "target_url": api_url,
                "proxy_used": mode == "scraperapi" and has_key,
                "classification": "error",
                "error": str(e),
                "elapsed_ms": int((time.monotonic() - api_started) * 1000),
            }

    # 2) Probe HTML listing page and run selector-based card detection.
    html_started = time.monotonic()
    html_target_url = rm._build_search_url(location, page=page)
    html_proxy_used = mode == "scraperapi" and has_key
    html_fetch_url = (
        rm.make_scraperapi_url(html_target_url, render=True) if html_proxy_used else html_target_url
    )

    html_headers = {"User-Agent": rm.USER_AGENT}

    try:
        html_status, html_text = await _fetch_text(
            session, html_fetch_url, headers=html_headers, timeout_seconds=timeout_seconds
        )
    except asyncio.TimeoutError:
        html_probe = {
            "target_url": html_target_url,
            "proxy_used": html_proxy_used,
            "classification": "timeout",
            "elapsed_ms": int((time.monotonic() - html_started) * 1000),
        }
        return {"api": api_probe, "html": html_probe}

    initial_blocked = bool(
        rm._looks_blocked(html_text, html_status) or _generic_blocked_markers(html_text)
    )
    initial_status = html_status
    initial_len = len(html_text or "")

    # Match scraper behavior: in direct mode, attempt ScraperAPI fallback when blocked.
    html_fallback_used = False
    if (not html_proxy_used) and has_key and initial_blocked:
        html_fallback_used = True
        try:
            proxy_url = rm.make_scraperapi_url(html_target_url, render=True)
            html_status, html_text = await _fetch_text(
                session, proxy_url, headers=html_headers, timeout_seconds=timeout_seconds
            )
        except Exception:
            html_status, html_text = initial_status, html_text

    blocked = bool(rm._looks_blocked(html_text, html_status) or _generic_blocked_markers(html_text))
    soup = BeautifulSoup(html_text, "html.parser")
    cards = rm._collect_selectors(soup)

    lowered = (html_text or "").lower()
    m = re.search(r"<title[^>]*>(.*?)</title>", html_text or "", re.IGNORECASE | re.DOTALL)
    title = "<none>"
    if m:
        title = re.sub(r"\s+", " ", (m.group(1) or "")).strip() or "<none>"

    next_data_present = "__next_data__" in lowered
    property_card_present = "propertycard" in lowered
    maybe_not_found = (
        "page-not-found" in lowered
        or "page not found" in lowered
        or "we couldn't find" in lowered
        or "we couldn’t find" in lowered
        or "find the place you were looking for" in lowered
    )

    if blocked:
        classification = "blocked"
    elif len(cards) > 0:
        classification = "parsed"
    elif maybe_not_found:
        classification = "redirected_not_found"
    else:
        classification = "fetched_no_cards"

    html_probe = {
        "target_url": html_target_url,
        "proxy_used": bool(html_proxy_used or html_fallback_used),
        "initial_http_status": initial_status,
        "initial_html_len": initial_len,
        "initial_blocked": initial_blocked,
        "proxy_fallback_used": html_fallback_used,
        "http_status": html_status,
        "html_len": len(html_text or ""),
        "title": title,
        "next_data_present": bool(next_data_present),
        "property_card_present": bool(property_card_present),
        "cards_found": len(cards),
        "blocked": blocked,
        "page_not_found_signal": maybe_not_found,
        "classification": classification,
        "elapsed_ms": int((time.monotonic() - html_started) * 1000),
    }

    # If we hit the deceptive Rightmove "place not found" page under ScraperAPI, attempt the
    # support-confirmed minimal URL via a plain ScraperAPI call (no keep_headers/country_code)
    # so this probe reflects the production fallback behavior.
    if (
        html_proxy_used
        and has_key
        and (not blocked)
        and classification == "redirected_not_found"
        and (html_text or "").strip()
    ):
        loc_id = rm._extract_location_identifier(html_target_url)
        if rm._is_region_location_identifier(loc_id):
            page_idx = rm._extract_page_index(html_target_url)
            minimal_target = rm._build_minimal_region_find_url(str(loc_id), page_idx)
            try:
                attempts_meta: List[Dict[str, Any]] = []
                for via, cc in (
                    ("rightmove-minimal-url-retry", None),
                    ("rightmove-minimal-url-retry-gb", "gb"),
                    ("rightmove-minimal-url-retry-uk", "uk"),
                ):
                    plain_proxy = rm.make_scraperapi_url(
                        minimal_target,
                        render=False,
                        premium=False,
                        ultra_premium=False,
                        country_code=cc,
                        keep_headers=None,
                        session_number=None,
                        auto_session_number=False,
                    )
                    st2, txt2 = await _fetch_text(
                        session,
                        plain_proxy,
                        headers=html_headers,
                        timeout_seconds=timeout_seconds,
                    )

                    low2 = (txt2 or "").lower()
                    m3 = re.search(
                        r"<title[^>]*>(.*?)</title>", txt2 or "", re.IGNORECASE | re.DOTALL
                    )
                    t3 = "<none>"
                    if m3:
                        t3 = re.sub(r"\s+", " ", (m3.group(1) or "")).strip() or "<none>"

                    nd3 = "__next_data__" in low2
                    pc3 = "propertycard" in low2
                    maybe_nf3 = rm._is_place_not_found_variant(txt2)
                    soup3 = BeautifulSoup(txt2, "html.parser")
                    cards3 = rm._collect_selectors(soup3)

                    meta = {
                        "via": via,
                        "target_url": minimal_target,
                        "http_status": st2,
                        "html_len": len(txt2 or ""),
                        "title": t3,
                        "next_data_present": bool(nd3),
                        "property_card_present": bool(pc3),
                        "cards_found": len(cards3),
                        "page_not_found_signal": bool(maybe_nf3),
                    }
                    attempts_meta.append(meta)

                    if st2 == 200 and (nd3 or pc3 or len(cards3) > 0):
                        # Update overall probe with recovered payload.
                        html_probe.update(
                            {
                                "via": via,
                                "target_url": minimal_target,
                                "http_status": st2,
                                "html_len": len(txt2 or ""),
                                "title": t3,
                                "next_data_present": bool(nd3),
                                "property_card_present": bool(pc3),
                                "cards_found": len(cards3),
                                "page_not_found_signal": bool(maybe_nf3),
                                "classification": (
                                    "parsed" if len(cards3) > 0 else "fetched_no_cards"
                                ),
                            }
                        )
                        break

                # Always attach attempt metadata for visibility.
                html_probe["minimal_retry_attempts"] = attempts_meta
                html_probe["minimal_retry_attempt"] = attempts_meta[0] if attempts_meta else None
            except Exception:
                pass

    # Optionally run a metadata-only escalation ladder so we can see whether
    # premium/ultra/country_code changes unlock the real listings HTML.
    if (
        include_escalation
        and html_proxy_used
        and has_key
        and (not blocked)
        and classification == "redirected_not_found"
        and (html_text or "").strip()
    ):
        attempts_meta: List[Dict[str, Any]] = []

        retry_targets = [html_target_url]
        if "%5e" in html_target_url.lower():
            alt_url = re.sub(r"%5e", "^", html_target_url, flags=re.IGNORECASE)
            if alt_url != html_target_url:
                retry_targets = [alt_url, html_target_url]

        attempts = [
            ("premium", dict(premium=True, ultra_premium=False, render=False), 70),
            ("premium_render", dict(premium=True, ultra_premium=False, render=True), 120),
            ("ultra", dict(premium=False, ultra_premium=True, render=False), 70),
            ("ultra_render", dict(premium=False, ultra_premium=True, render=True), 120),
        ]

        recovered = False
        for target_url in retry_targets:
            for cc in ("gb", "uk"):
                for via_suffix, opts, tmo in attempts:
                    try:
                        proxy_url = rm.make_scraperapi_url(
                            target_url,
                            keep_headers=True,
                            country_code=cc,
                            session_number=str(random.randint(1, 999999)),
                            **opts,
                        )
                        st, txt = await _fetch_text(
                            session,
                            proxy_url,
                            headers=html_headers,
                            timeout_seconds=min(max(tmo, 20), timeout_seconds),
                        )
                    except Exception as e:  # pragma: no cover
                        attempts_meta.append(
                            {
                                "via": f"{via_suffix}-{cc}",
                                "target_url": target_url,
                                "http_status": 0,
                                "html_len": 0,
                                "title": "<error>",
                                "next_data_present": False,
                                "property_card_present": False,
                                "error": str(e),
                            }
                        )
                        continue

                    low = (txt or "").lower()
                    m2 = re.search(
                        r"<title[^>]*>(.*?)</title>", txt or "", re.IGNORECASE | re.DOTALL
                    )
                    t2 = "<none>"
                    if m2:
                        t2 = re.sub(r"\s+", " ", (m2.group(1) or "")).strip() or "<none>"

                    nd2 = "__next_data__" in low
                    pc2 = "propertycard" in low

                    attempts_meta.append(
                        {
                            "via": f"{via_suffix}-{cc}",
                            "target_url": target_url,
                            "http_status": st,
                            "html_len": len(txt or ""),
                            "title": t2,
                            "next_data_present": bool(nd2),
                            "property_card_present": bool(pc2),
                        }
                    )

                    if st == 200 and (nd2 or pc2):
                        recovered = True
                        break
                if recovered:
                    break
            if recovered:
                break

        html_probe["escalation_attempts"] = attempts_meta
        html_probe["escalation_recovered"] = bool(recovered)

    return {"api": api_probe, "html": html_probe}


async def _probe_onthemarket(
    session: Any, location: str, page: int, timeout_seconds: int
) -> Dict[str, Any]:
    from bs4 import BeautifulSoup

    from backend.scraper import onthemarket_scraper as otm

    target_url = otm._build_search_url(location, page=page)

    mode = (os.getenv("SCRAPER_MODE") or "direct").lower()
    has_key = bool((os.getenv("SCRAPERAPI_KEY") or "").strip())
    proxy_used = mode == "scraperapi" and has_key

    headers = {"User-Agent": otm.USER_AGENT, "Accept-Language": "en-GB,en;q=0.9"}

    started = time.monotonic()
    try:
        fetch_url = otm.make_scraperapi_url(target_url, render=True) if proxy_used else target_url
        status, text = await _fetch_text(
            session, fetch_url, headers=headers, timeout_seconds=timeout_seconds
        )
    except asyncio.TimeoutError:
        return {
            "target_url": target_url,
            "proxy_used": proxy_used,
            "classification": "timeout",
            "elapsed_ms": int((time.monotonic() - started) * 1000),
        }

    initial_blocked = bool(otm._looks_blocked(text, status) or _generic_blocked_markers(text))
    initial_status = status
    initial_len = len(text or "")

    fallback_used = False
    if (not proxy_used) and has_key and initial_blocked:
        fallback_used = True
        try:
            proxy_url = otm.make_scraperapi_url(target_url, render=True)
            status, text = await _fetch_text(
                session, proxy_url, headers=headers, timeout_seconds=max(timeout_seconds, 60)
            )
        except Exception:
            status, text = initial_status, text

    blocked_by_heuristic = bool(otm._looks_blocked(text, status) or _generic_blocked_markers(text))
    soup = BeautifulSoup(text, "html.parser")
    cards = otm._collect_cards(soup)

    blocked_final, classification = _final_block_status(
        blocked_by_heuristic=blocked_by_heuristic, cards_found=len(cards)
    )
    if classification == "ok" and len(cards) == 0:
        classification = "fetched_no_cards"

    return {
        "target_url": target_url,
        "proxy_used": bool(proxy_used or fallback_used),
        "initial_http_status": initial_status,
        "initial_html_len": initial_len,
        "initial_blocked": initial_blocked,
        "proxy_fallback_used": fallback_used,
        "http_status": status,
        "html_len": len(text or ""),
        "cards_found": len(cards),
        "blocked_by_heuristic": blocked_by_heuristic,
        "blocked": blocked_final,
        "classification": classification,
        "elapsed_ms": int((time.monotonic() - started) * 1000),
    }


async def _probe_spareroom(
    session: Any, location: str, page: int, timeout_seconds: int
) -> Dict[str, Any]:
    from bs4 import BeautifulSoup

    from backend.scraper import spare_room_scraper as sr

    target_url = sr._build_search_url(location, page=page)

    mode = (os.getenv("SCRAPER_MODE") or "direct").lower()
    has_key = bool((os.getenv("SCRAPERAPI_KEY") or "").strip())
    proxy_used = mode == "scraperapi" and has_key

    headers = {"User-Agent": sr.USER_AGENT, "Accept-Language": "en-GB,en;q=0.9"}

    started = time.monotonic()
    try:
        fetch_url = sr.make_scraperapi_url(target_url, render=True) if proxy_used else target_url
        status, text = await _fetch_text(
            session, fetch_url, headers=headers, timeout_seconds=timeout_seconds
        )
    except asyncio.TimeoutError:
        return {
            "target_url": target_url,
            "proxy_used": proxy_used,
            "classification": "timeout",
            "elapsed_ms": int((time.monotonic() - started) * 1000),
        }

    initial_blocked = bool(sr._looks_blocked(text, status) or _generic_blocked_markers(text))
    initial_status = status
    initial_len = len(text or "")

    fallback_used = False
    if (not proxy_used) and has_key and initial_blocked:
        fallback_used = True
        try:
            proxy_url = sr.make_scraperapi_url(target_url, render=True)
            status, text = await _fetch_text(
                session, proxy_url, headers=headers, timeout_seconds=max(timeout_seconds, 60)
            )
        except Exception:
            status, text = initial_status, text

    blocked_by_heuristic = bool(sr._looks_blocked(text, status) or _generic_blocked_markers(text))
    soup = BeautifulSoup(text, "html.parser")
    cards = sr._collect_cards(soup)

    blocked_final, classification = _final_block_status(
        blocked_by_heuristic=blocked_by_heuristic, cards_found=len(cards)
    )
    if classification == "ok" and len(cards) == 0:
        classification = "fetched_no_cards"

    return {
        "target_url": target_url,
        "proxy_used": bool(proxy_used or fallback_used),
        "initial_http_status": initial_status,
        "initial_html_len": initial_len,
        "initial_blocked": initial_blocked,
        "proxy_fallback_used": fallback_used,
        "http_status": status,
        "html_len": len(text or ""),
        "cards_found": len(cards),
        "blocked_by_heuristic": blocked_by_heuristic,
        "blocked": blocked_final,
        "classification": classification,
        "elapsed_ms": int((time.monotonic() - started) * 1000),
    }


async def _run_probe(
    location: str,
    *,
    sources: List[str],
    page: int,
    timeout_seconds: int,
    include_escalation: bool,
) -> Dict[str, Any]:
    import aiohttp

    out: Dict[str, Any] = {}

    async with aiohttp.ClientSession() as session:
        tasks: Dict[str, Any] = {}

        if "zoopla" in sources:
            tasks["zoopla"] = asyncio.create_task(
                _probe_zoopla(session, location, page, timeout_seconds)
            )
        if "rightmove" in sources:
            tasks["rightmove"] = asyncio.create_task(
                _probe_rightmove(
                    session,
                    location,
                    page,
                    timeout_seconds,
                    include_escalation=include_escalation,
                )
            )
        if "onthemarket" in sources:
            tasks["onthemarket"] = asyncio.create_task(
                _probe_onthemarket(session, location, page, timeout_seconds)
            )
        if "spareroom" in sources:
            tasks["spareroom"] = asyncio.create_task(
                _probe_spareroom(session, location, page, timeout_seconds)
            )

        for name, task in tasks.items():
            try:
                out[name] = await task
            except Exception as e:
                out[name] = {"classification": "error", "error": str(e)}

    return out


@router.get("/debug/scrape-probe")
async def debug_scrape_probe(
    location: str = Query(..., description="Location e.g. London"),
    sources: str | None = Query(
        None,
        description="Comma-separated subset: zoopla,rightmove,onthemarket,spareroom",
    ),
    page: int = Query(0, ge=0, le=3, description="Page index to probe (0-based)"),
    timeout_seconds: int = Query(
        int(os.getenv("SCRAPE_PROBE_TIMEOUT_SECONDS", os.getenv("SCRAPER_TIMEOUT_SECONDS", "35"))),
        ge=5,
        le=120,
        description="Total timeout per probe request",
    ),
    include_escalation: bool = Query(
        False,
        description="When true, runs an additional premium/ultra escalation ladder for Rightmove; can be slow",
    ),
    x_admin_token: str | None = Header(None),
):
    """Probe each scraper source and report blocked vs parsed vs timeout.

    Returns only metadata (status codes, lengths, counts). Never returns raw HTML.
    Protected by IMPORT_ADMIN_TOKEN when configured.
    """
    _require_admin(x_admin_token)

    loc = (location or "").strip()
    if not loc:
        raise HTTPException(status_code=422, detail="Missing location")

    selected = _safe_source_list(sources)
    if not selected:
        raise HTTPException(status_code=422, detail="No valid sources requested")

    started = time.monotonic()
    results = await _run_probe(
        loc,
        sources=selected,
        page=page,
        timeout_seconds=timeout_seconds,
        include_escalation=include_escalation,
    )

    return {
        "ok": True,
        "ts": _now_iso(),
        "location": loc,
        "sources": selected,
        "scraper_mode": (os.getenv("SCRAPER_MODE") or "direct"),
        "scraperapi_enabled": bool((os.getenv("SCRAPERAPI_KEY") or "").strip()),
        "playwright_enabled": (os.getenv("PLAYWRIGHT_ENABLE") or "0") == "1",
        "timeout_seconds": timeout_seconds,
        "include_escalation": include_escalation,
        "elapsed_ms": int((time.monotonic() - started) * 1000),
        "results": results,
    }
