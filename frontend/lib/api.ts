const BASE = process.env.NEXT_PUBLIC_API_URL

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE) throw new Error('NEXT_PUBLIC_API_URL is not set')
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store', ...init })
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export async function apiPost<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  if (!BASE) throw new Error('NEXT_PUBLIC_API_URL is not set')
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
    ...init,
  })
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}
