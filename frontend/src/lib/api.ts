/** All browser → backend calls go through here (FRONTEND.md §2.2), via the same-origin /api proxy. */

/** Demo mode only (NEXT_PUBLIC_LUMEN_DEMO=1): the in-browser demo backend answers instead of the network. */
async function send(path: string, init: RequestInit): Promise<Response> {
  // Inline env check (not an imported constant) so the real build drops this branch and the demo code entirely.
  if (process.env.NEXT_PUBLIC_LUMEN_DEMO === "1") return (await import("@/lib/demo/server")).demoFetch(path, init);
  return fetch(path, init);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

// Auth endpoints whose 401 means "wrong credentials / no session", never "access token expired".
const NO_REFRESH = new Set(["/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/logout"]);

let refreshing: Promise<boolean> | null = null;
function refreshOnce(): Promise<boolean> {
  refreshing ??= send("/api/auth/refresh", { method: "POST", credentials: "include" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

export async function apiFetch(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const jsonBody = init.body !== undefined && !(init.body instanceof FormData);
  let res: Response;
  try {
    res = await send(path, {
      credentials: "include",
      ...init,
      headers: { ...(jsonBody ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach Lumen. Check that the app is running.");
  }
  if (res.status === 401 && !retried && !NO_REFRESH.has(path.split("?")[0])) {
    if (await refreshOnce()) return apiFetch(path, init, true);
    // Full reload on purpose: drop every in-memory state of the expired session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
  }
  if (!res.ok && !(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string; details?: Record<string, unknown> };
    throw new ApiError(res.status, body.code ?? "INTERNAL_ERROR", body.message ?? "Something went wrong.", body.details);
  }
  return res;
}

const json = <T>(r: Response) => (r.status === 204 ? (undefined as T) : (r.json() as Promise<T>));

export const api = {
  get: <T>(p: string, signal?: AbortSignal) => apiFetch(p, { signal }).then((r) => json<T>(r)),
  post: <T>(p: string, body?: unknown) =>
    apiFetch(p, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }).then((r) => json<T>(r)),
  patch: <T>(p: string, body: unknown) =>
    apiFetch(p, { method: "PATCH", body: JSON.stringify(body) }).then((r) => json<T>(r)),
  put: <T>(p: string, body: unknown) => apiFetch(p, { method: "PUT", body: JSON.stringify(body) }).then((r) => json<T>(r)),
  del: (p: string) => apiFetch(p, { method: "DELETE" }).then(() => undefined),
};
