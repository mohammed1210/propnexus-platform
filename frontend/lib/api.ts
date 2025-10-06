// /lib/api.ts
/**
 * Centralized API helpers for PropNexus frontend.
 * Handles GPT endpoints (summary + strategies) and any REST calls to backend.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "";

// --------------- Utilities ---------------

async function safeFetch(path: string, options?: RequestInit) {
  const url = `${API_BASE.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      ...options,
    });
    if (!res.ok) {
      console.error(`[API] ${res.status} ${res.statusText} for ${url}`);
      throw new Error(`Request failed (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    console.error("[API fetch error]", err);
    throw err;
  }
}

// --------------- AI Summary ---------------

/**
 * Generates a short investment summary and key bullet points.
 * Accepts a flat property object (title, price, ROI, yield, etc.)
 * or old shape { property: {...} }.
 */
export async function postAiSummary(property: Record<string, any>) {
  try {
    const body = JSON.stringify(property?.title ? property : { property });
    const data = await safeFetch("/ai/summary", {
      method: "POST",
      body,
    });
    return data;
  } catch (err) {
    console.error("AI Summary error:", err);
    return {
      summary: "Unable to generate summary.",
      bullets: [],
    };
  }
}

// --------------- AI Exit Strategies ---------------

/**
 * Generates exit strategies for a given property deal.
 */
export async function postAiStrategies(payload: Record<string, any>) {
  try {
    const body = JSON.stringify(payload);
    const data = await safeFetch("/ai/generate-strategies", {
      method: "POST",
      body,
    });
    return data;
  } catch (err) {
    console.error("AI Strategies error:", err);
    return { strategies: ["Unable to generate strategies."] };
  }
}

// --------------- Other Helpers ---------------

export async function getProperties() {
  return safeFetch("/properties");
}

export async function getPropertyById(id: string) {
  return safeFetch(`/properties/${id}`);
}

export async function triggerScraper(source: "rightmove" | "zoopla") {
  return safeFetch(`/scrape-${source}`, { method: "POST" });
}
