// frontend/lib/api.ts
type JSONValue = any;

export const BASE =
  (process.env.NEXT_PUBLIC_API_BASE as string | undefined) ??
  (process.env.NEXT_PUBLIC_API_BASE_URL as string | undefined) ??
  "";

/** Generic POST */
export async function apiPost<T>(path: string, body: JSONValue): Promise<T> {
  const url = `${BASE.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** --- AI endpoints (typed) --- **/
export async function postAiSummary(payload: any) {
  return apiPost("/generate-summary", payload);
}

export async function postAiStrategies(payload: any) {
  return apiPost("/generate-strategies", payload);
}
