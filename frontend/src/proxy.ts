import { NextResponse, type NextRequest } from "next/server";
import { DEMO, DEMO_COOKIE } from "@/lib/demo/mode";

/**
 * Optimistic route guard, both ways:
 * - signed out → app pages redirect to /login?next=…
 * - signed in → the landing page and the auth pages redirect to /chat (or to a safe ?next=)
 *
 * "Signed in" means the `session_hint` cookie the backend sets on login (the refresh cookie is scoped to
 * /api/auth, so pages can't see it). The backend still checks every API call; a session that can't be refreshed
 * gets its cookies cleared by /api/auth/refresh, so this guard can never bounce between /login and /chat.
 */
const APP = ["/chat", "/documents", "/image", "/learn", "/settings", "/test"];
const PUBLIC_ONLY = ["/", "/login", "/signup", "/forgot-password", "/verify", "/reset-password"];

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

/** Only same-site app paths; never "//host" or a scheme. */
function safeNext(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  return APP.some((base) => under(raw.split(/[?#]/)[0], base)) ? raw : null;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // The demo build uses its own cookie, so it never touches the real app's session on the same host.
  const signedIn = DEMO
    ? request.cookies.get(DEMO_COOKIE)?.value === "1"
    : request.cookies.has("access_token") || request.cookies.get("session_hint")?.value === "1";

  if (APP.some((base) => under(pathname, base))) {
    if (signedIn) return NextResponse.next();
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  if (signedIn && PUBLIC_ONLY.includes(pathname)) {
    const next = safeNext(request.nextUrl.searchParams.get("next")) ?? "/chat";
    return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/verify",
    "/reset-password",
    "/chat/:path*",
    "/documents/:path*",
    "/image/:path*",
    "/learn/:path*",
    "/settings/:path*",
    "/test/:path*",
  ],
};
