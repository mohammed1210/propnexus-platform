// Scraper provider abstraction with fallback and backoff.
export type Mode = "direct" | "scraperapi" | "nojs";

function botWallDetected(html: string, status: number): boolean {
  const lower = html.toLowerCase();
  return (
    status >= 403 &&
    /robot|captcha|verify|access denied/.test(lower)
  );
}

export async function fetchSearchPage(
  url: string,
  mode: Mode,
  attempt = 1,
): Promise<{ html: string; status: number; meta?: any }> {
  const maxAttempts = parseInt(process.env.SCRAPER_MAX_RETRIES || "4", 10);
  const backoff = parseInt(process.env.SCRAPER_BACKOFF_BASE_MS || "500", 10);
  try {
    let fetchUrl = url;
    if (mode === "scraperapi" && process.env.SCRAPERAPI_KEY) {
      fetchUrl = `http://api.scraperapi.com?api_key=${process.env.SCRAPERAPI_KEY}&url=${encodeURIComponent(url)}`;
    }
    const res = await fetch(fetchUrl);
    const html = await res.text();
    const status = res.status;
    if (
      mode === "direct" &&
      botWallDetected(html, status) &&
      process.env.SCRAPERAPI_KEY
    ) {
      // Fallback to scraperapi
      return fetchSearchPage(url, "scraperapi", attempt);
    }
    return { html, status };
  } catch (err: any) {
    if (attempt < maxAttempts) {
      const delay = backoff * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchSearchPage(url, mode, attempt + 1);
    }
    throw err;
  }
}
