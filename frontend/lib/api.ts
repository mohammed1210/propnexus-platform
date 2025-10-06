// /lib/api.ts

/**
 * Generic helper for calling backend API endpoints.
 * Automatically prefixes base URL (from .env or same-origin).
 */

export async function apiPost(path: string, body: any) {
  const base =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "";

  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API POST ${path} failed: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Optional generic GET wrapper if needed later.
 */
export async function apiGet(path: string) {
  const base =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "";

  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url);

  if (!res.ok) throw new Error(`API GET ${path} failed: ${res.status}`);
  return res.json();
}
