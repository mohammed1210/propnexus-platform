// frontend/lib/api.ts
function getBase(): string {
  const base =
    process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new Error(
      "API base URL is not set. Define NEXT_PUBLIC_BACKEND_URL or NEXT_PUBLIC_API_URL."
    );
  }
  // strip trailing slash
  return base.replace(/\/$/, "");
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getBase()}${path}`;
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  init?: RequestInit
): Promise<T> {
  const url = `${getBase()}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
    ...init,
  });
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
