import "server-only";

/**
 * Single entry point for the future backend. Not used yet: services return
 * mocks today; switch a service body to call this when its endpoint exists.
 */
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(new URL(path, API_BASE_URL), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status} on ${path}`);
  }
  return res.json() as Promise<T>;
}
