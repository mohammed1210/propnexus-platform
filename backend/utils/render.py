import os
import asyncio
import time
from typing import Optional, Sequence
from pathlib import Path

PLAYWRIGHT_ENABLE = os.getenv("PLAYWRIGHT_ENABLE", "0") == "1"
PLAYWRIGHT_TIMEOUT_MS = int(os.getenv("PLAYWRIGHT_TIMEOUT_MS", "15000"))
PLAYWRIGHT_BROWSER = os.getenv("PLAYWRIGHT_BROWSER", "chromium")
PLAYWRIGHT_SCROLL_STEPS = int(os.getenv("PLAYWRIGHT_SCROLL_STEPS", "5"))
PLAYWRIGHT_WAIT_SELECTOR_TIMEOUT_MS = int(os.getenv("PLAYWRIGHT_WAIT_SELECTOR_TIMEOUT_MS", "6000"))
PLAYWRIGHT_DEBUG_CAPTURE = os.getenv("PLAYWRIGHT_DEBUG_CAPTURE", "0") == "1"
_DEBUG_DIR = Path("backend/debug")

async def render_page(
    url: str,
    selectors: Sequence[str] | None = None,
    click_selectors: Sequence[str] | None = None,
) -> Optional[str]:
    """Render a page using Playwright if enabled.

    selectors: list of CSS selectors expected to appear; we wait for the first.
    Returns HTML or None on failure.
    """
    if not PLAYWRIGHT_ENABLE:
        return None
    try:
        from playwright.async_api import async_playwright  # type: ignore
    except Exception:
        return None

    # Simple singleton cache stored on the loop object
    loop = asyncio.get_event_loop()
    if not hasattr(loop, "_pw_browser"):
        try:
            pw = await async_playwright().start()
            browser = await getattr(pw, PLAYWRIGHT_BROWSER).launch(headless=True)
            context = await browser.new_context()
            loop._pw_playwright = pw  # type: ignore
            loop._pw_browser = browser  # type: ignore
            loop._pw_context = context  # type: ignore
        except Exception:
            return None

    context = loop._pw_context  # type: ignore
    try:
        page = await context.new_page()
        await page.goto(url, timeout=PLAYWRIGHT_TIMEOUT_MS, wait_until="domcontentloaded")
        # Attempt to dismiss cookie / consent / simple challenges by clicking provided selectors
        if click_selectors:
            for sel in click_selectors:
                try:
                    el = page.locator(sel).first
                    if await el.count() > 0:
                        await el.click(timeout=2000)
                        await asyncio.sleep(0.2)
                except Exception:
                    continue

        # Optional selector wait
        if selectors:
            found = False
            deadline = time.time() + (PLAYWRIGHT_WAIT_SELECTOR_TIMEOUT_MS / 1000.0)
            while time.time() < deadline and not found:
                for sel in selectors:
                    try:
                        el = await page.query_selector(sel)
                        if el:
                            found = True
                            break
                    except Exception:
                        continue
                if not found:
                    await asyncio.sleep(0.25)

        # Scrolling to trigger lazy content
        for _ in range(max(1, PLAYWRIGHT_SCROLL_STEPS)):
            try:
                await page.evaluate("window.scrollBy(0, window.innerHeight)")
            except Exception:
                break
            await asyncio.sleep(0.35)

        # Network idle attempt (best-effort)
        try:
            await page.wait_for_load_state("networkidle", timeout=3000)
        except Exception:
            pass

        html = await page.content()
        await page.close()
        return html
    except Exception:
        return None

async def ensure_shutdown() -> None:
    """Gracefully close Playwright browser if it was started."""
    loop = asyncio.get_event_loop()
    pw = getattr(loop, "_pw_playwright", None)
    browser = getattr(loop, "_pw_browser", None)
    if pw and browser:
        try:
            await browser.close()
            await pw.stop()
        except Exception:
            pass

def capture_debug_html(name: str, html: str) -> None:
    if not PLAYWRIGHT_DEBUG_CAPTURE:
        return
    try:
        _DEBUG_DIR.mkdir(parents=True, exist_ok=True)
        safe = name.replace("/", "_")
        path = _DEBUG_DIR / f"{safe}.html"
        snippet = html[:150000]  # cap size
        path.write_text(snippet, encoding="utf-8")
    except Exception:
        pass

def capture_debug_json(name: str, obj: dict) -> None:
    if not PLAYWRIGHT_DEBUG_CAPTURE:
        return
    try:
        _DEBUG_DIR.mkdir(parents=True, exist_ok=True)
        safe = name.replace('/', '_')
        path = _DEBUG_DIR / f"{safe}.json"
        import json
        path.write_text(json.dumps(obj, ensure_ascii=False, indent=2)[:150000], encoding='utf-8')
    except Exception:
        pass


async def render_page_capture(
    url: str,
    selectors: Sequence[str] | None = None,
    click_selectors: Sequence[str] | None = None,
    response_url_substrings: Sequence[str] | None = None,
    max_json: int = 8,
) -> tuple[Optional[str], list[dict]]:
    """Render a page and capture JSON responses whose URL contains any provided substrings.

    Returns (html, captured_json_payloads).
    """
    if not PLAYWRIGHT_ENABLE:
        return None, []
    try:
        from playwright.async_api import async_playwright  # type: ignore
    except Exception:
        return None, []

    loop = asyncio.get_event_loop()
    if not hasattr(loop, "_pw_browser"):
        try:
            pw = await async_playwright().start()
            browser = await getattr(pw, PLAYWRIGHT_BROWSER).launch(headless=True)
            context = await browser.new_context()
            loop._pw_playwright = pw  # type: ignore
            loop._pw_browser = browser  # type: ignore
            loop._pw_context = context  # type: ignore
        except Exception:
            return None, []
    context = loop._pw_context  # type: ignore
    captured: list[dict] = []
    try:
        page = await context.new_page()

        if response_url_substrings:
            substrings = list(response_url_substrings)
            def _match(u: str) -> bool:
                ul = u.lower()
                return any(s.lower() in ul for s in substrings)
            async def handle_response(resp):  # type: ignore
                try:
                    if len(captured) >= max_json:
                        return
                    url_r = resp.url
                    if not _match(url_r):
                        return
                    ct = resp.headers.get("content-type", "")
                    if "json" not in ct:
                        return
                    data = await resp.json()
                    if isinstance(data, dict):
                        captured.append({"url": url_r, "data": data})
                        capture_debug_json(f"capture_{hash(url_r) & 0xffffffff}", data)
                except Exception:
                    pass
            page.on("response", handle_response)  # type: ignore

        await page.goto(url, timeout=PLAYWRIGHT_TIMEOUT_MS, wait_until="domcontentloaded")

        if click_selectors:
            for sel in click_selectors:
                try:
                    el = page.locator(sel).first
                    if await el.count() > 0:
                        await el.click(timeout=2000)
                        await asyncio.sleep(0.25)
                except Exception:
                    continue

        # Wait for selectors
        if selectors:
            deadline = time.time() + (PLAYWRIGHT_WAIT_SELECTOR_TIMEOUT_MS / 1000.0)
            while time.time() < deadline:
                ok = False
                for sel in selectors:
                    try:
                        el = await page.query_selector(sel)
                        if el:
                            ok = True
                            break
                    except Exception:
                        continue
                if ok:
                    break
                await asyncio.sleep(0.3)

        # Scroll
        for _ in range(max(1, PLAYWRIGHT_SCROLL_STEPS)):
            try:
                await page.evaluate("window.scrollBy(0, window.innerHeight)")
            except Exception:
                break
            await asyncio.sleep(0.3)

        try:
            await page.wait_for_load_state("networkidle", timeout=3000)
        except Exception:
            pass
        html = await page.content()
        await page.close()
        return html, captured
    except Exception:
        return None, captured