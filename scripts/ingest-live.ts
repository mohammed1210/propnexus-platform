#!/usr/bin/env node
// CLI script for scraping search pages with fallback and structured logs.
import { fetchSearchPage, Mode } from "./providers/scraper-provider";

function parseArgs(): { url: string; mode: Mode } {
  const args = process.argv.slice(2);
  let url = "";
  let mode: Mode = (process.env.SCRAPER_MODE as Mode) || "direct";
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--") && !url) {
      url = args[i];
    } else if (args[i] === "--mode" && args[i + 1]) {
      mode = args[i + 1] as Mode;
      i++;
    }
  }
  if (!url) {
    console.error("Usage: ingest-live.ts <url> [--mode direct|scraperapi|nojs]");
    process.exit(1);
  }
  return { url, mode };
}

(async () => {
  const { url, mode } = parseArgs();
  try {
    const result = await fetchSearchPage(url, mode);
    console.log(
      JSON.stringify({
        level: "info",
        url,
        attempt: 1,
        mode,
        status: result.status,
        html: result.html.slice(0, 200),
      }),
    );
  } catch (err: any) {
    console.error(
      JSON.stringify({
        level: "error",
        url,
        message: err.message || String(err),
      }),
    );
    process.exit(1);
  }
})();
