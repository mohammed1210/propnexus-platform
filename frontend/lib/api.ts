import {
  SummaryRequest,
  SummaryResponse,
  StrategiesRequest,
  StrategiesResponse,
} from "../types/ai";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

async function postAiSummary(payload: SummaryRequest): Promise<SummaryResponse> {
  const res = await fetch(`${API_BASE}/ai/summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to fetch AI summary");
  }
  return (await res.json()) as SummaryResponse;
}

async function postAiStrategies(
  payload: StrategiesRequest,
): Promise<StrategiesResponse> {
  const res = await fetch(`${API_BASE}/ai/strategies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to fetch AI strategies");
  }
  return (await res.json()) as StrategiesResponse;
}

export { postAiSummary, postAiStrategies };
