import { api, apiFetch, ApiError } from "@/lib/api";
import type { AuthResponse } from "@/types/api";
import type { AuthResult } from "@/types/auth";

/** Browser-side auth calls (FRONTEND.md §7.1). The backend sets the session cookies through the /api proxy. */

function failure(e: unknown): AuthResult<never> {
  if (!(e instanceof ApiError)) return { ok: false, message: "auth.errors.invalidRequest" };
  switch (e.code) {
    case "INVALID_CREDENTIALS":
      return { ok: false, message: "auth.errors.wrongCredentials" };
    case "EMAIL_TAKEN":
      return { ok: false, fieldErrors: { email: "auth.errors.emailTaken" } };
    case "RATE_LIMITED":
      return { ok: false, message: "auth.errors.rateLimited" };
    case "NETWORK_ERROR":
    case "BACKEND_UNAVAILABLE":
      return { ok: false, message: "auth.errors.serverDown" };
    default:
      return { ok: false, message: e.status >= 500 ? "auth.errors.serverDown" : "auth.errors.invalidRequest" };
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    await api.post<AuthResponse>("/api/auth/login", { email, password });
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function signUp(name: string, email: string, password: string): Promise<AuthResult> {
  try {
    await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
      headers: { "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone },
    });
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

/** Where to go after signing in: the guarded page the user came from, else /chat. Same-site paths only. */
export function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/chat";
}
