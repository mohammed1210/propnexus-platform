import os
import aiohttp
from typing import Optional

try:
    from supabase import Client, create_client
except ImportError:
    Client = object
    def create_client(*args, **kwargs):
        return None

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


async def insert_property_to_supabase(property_data):
    if not supabase:
        print("⚠️ Supabase client not configured")
        return
    data = {
        "title": property_data["title"],
        "location": property_data["location"],
        "price": property_data["price"],
        "yield_percent": property_data["yield_percent"],
        "roi_percent": property_data["roi_percent"],
        "bmv": property_data["bmv"],
        "imageurl": property_data["image_url"],
        "description": property_data["description"],
        "source": property_data["source"],
    }
    supabase.table("properties").insert(data).execute()


# Smart ScraperAPI mode configuration
# Note: These are read at function call time to allow testing with different env vars
CAPTCHA_KEYWORDS = ["captcha", "access denied", "unusual traffic", "bot detection", "robot"]


def _get_scraper_mode() -> str:
    """Get current scraper mode from environment"""
    return os.getenv("SCRAPER_MODE", "direct").lower()


def _get_scraperapi_key() -> str:
    """Get ScraperAPI key from environment"""
    return os.getenv("SCRAPERAPI_KEY", "").strip()


def _looks_blocked(html: str, status: int) -> bool:
    """Check if response indicates blocking or captcha."""
    if status in (403, 503):
        return True
    lowered = html.lower()
    return any(k in lowered for k in CAPTCHA_KEYWORDS)


def _is_valid_html(html: str) -> bool:
    """Check if HTML response is valid and not obviously broken."""
    if not html or len(html) < 20:  # Minimum viable HTML
        return False
    # Basic sanity checks (case-insensitive)
    lowered = html.lower()
    return any(tag in lowered for tag in ["<html", "<body", "<div", "<!doctype"])


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
    
    Args:
        session: aiohttp ClientSession
        url: URL to fetch
        headers: Request headers
        timeout: Request timeout in seconds
        
    Returns:
        HTML content or None if all methods fail
    """
    
    # Read mode at call time for testing
    scraper_mode = _get_scraper_mode()
    scraperapi_key = _get_scraperapi_key()
    
    # Mode: scraperapi-only (current behavior)
    if scraper_mode == "scraperapi":
        if not scraperapi_key:
            print(f"⚠️ SCRAPER_MODE=scraperapi but SCRAPERAPI_KEY not set")
            return None
        proxy_url = (
            f"http://api.scraperapi.com/?api_key={scraperapi_key}&url={url}"
            f"&country_code=gb&render=true&device_type=desktop"
        )
        try:
            async with session.get(proxy_url, headers=headers, timeout=60) as resp:
                text = await resp.text()
                if _looks_blocked(text, resp.status):
                    return None
                return text
        except Exception as e:
            print(f"⚠️ ScraperAPI fetch failed: {e}")
            return None
    
    # Mode: smart fallback
    elif scraper_mode == "smart":
        # Step 1: Try direct fetch first
        try:
            async with session.get(url, headers=headers, timeout=timeout) as resp:
                text = await resp.text()
                if not _looks_blocked(text, resp.status) and _is_valid_html(text):
                    return text
                print(f"ℹ️ Direct fetch blocked or invalid, trying ScraperAPI...")
        except Exception as e:
            print(f"ℹ️ Direct fetch failed ({e}), trying ScraperAPI...")
        
        # Step 2: Try ScraperAPI without render (cheap)
        if scraperapi_key:
            proxy_url = f"http://api.scraperapi.com/?api_key={scraperapi_key}&url={url}&country_code=gb"
            try:
                async with session.get(proxy_url, headers=headers, timeout=45) as resp:
                    text = await resp.text()
                    if not _looks_blocked(text, resp.status) and _is_valid_html(text):
                        print(f"✅ ScraperAPI (no-render) successful")
                        return text
                    print(f"ℹ️ ScraperAPI (no-render) blocked, trying with render...")
            except Exception as e:
                print(f"ℹ️ ScraperAPI (no-render) failed ({e}), trying with render...")
            
            # Step 3: Try ScraperAPI with render (expensive)
            proxy_url_render = (
                f"http://api.scraperapi.com/?api_key={scraperapi_key}&url={url}"
                f"&country_code=gb&render=true&device_type=desktop"
            )
            try:
                async with session.get(proxy_url_render, headers=headers, timeout=60) as resp:
                    text = await resp.text()
                    if _looks_blocked(text, resp.status):
                        print(f"⚠️ ScraperAPI (with render) still blocked")
                        return None
                    print(f"✅ ScraperAPI (with render) successful")
                    return text
            except Exception as e:
                print(f"⚠️ ScraperAPI (with render) failed: {e}")
                return None
        else:
            print(f"⚠️ ScraperAPI key not configured, cannot fallback")
            return None
    
    # Mode: direct (default, current behavior)
    else:
        try:
            async with session.get(url, headers=headers, timeout=timeout) as resp:
                text = await resp.text()
                # Backward compatibility: fallback to ScraperAPI if blocked in direct mode
                if _looks_blocked(text, resp.status) and scraperapi_key:
                    print(f"ℹ️ Direct mode blocked, falling back to ScraperAPI...")
                    proxy_url = (
                        f"http://api.scraperapi.com/?api_key={scraperapi_key}&url={url}"
                        f"&country_code=gb&render=true&device_type=desktop"
                    )
                    async with session.get(proxy_url, headers=headers, timeout=60) as p_resp:
                        p_text = await p_resp.text()
                        if _looks_blocked(p_text, p_resp.status):
                            return None
                        return p_text
                return text
        except Exception as e:
            # Backward compatibility: fallback to ScraperAPI on exception
            if scraperapi_key:
                print(f"ℹ️ Direct mode exception ({e}), falling back to ScraperAPI...")
                proxy_url = (
                    f"http://api.scraperapi.com/?api_key={scraperapi_key}&url={url}"
                    f"&country_code=gb&render=true&device_type=desktop"
                )
                try:
                    async with session.get(proxy_url, headers=headers, timeout=60) as p_resp:
                        p_text = await p_resp.text()
                        if _looks_blocked(p_text, p_resp.status):
                            return None
                        return p_text
                except Exception:
                    return None
            return None

